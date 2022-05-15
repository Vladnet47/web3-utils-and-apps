const { ethers } = require('ethers');
const { getTxCost, printTx, send, simulate, notify, decodeTx, getBaseFee } = require('../../utils');
const { Listing, Token } = require('./objects');

const IFACE = new ethers.utils.Interface([
    'function matchAskWithTakerBidUsingETHAndWETH((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchAskWithTakerBid((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchBidWithTakerAsk((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function batchBuyFromOpenSea(tuple(uint256 value, bytes tradeData)[] openseaTrades) payable',
    'function batchBuyWithETH(tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails) payable',
    'function batchBuyWithERC20s(tuple(address[] tokenAddrs, uint256[] amounts) erc20Details, tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails, tuple(bytes conversionData)[] converstionDetails, address[] dustTokens) payable',
]);

class FarmingController {
    constructor(provider, signerManager, policyManager, cancelManager, requests, debug) {
        if (!provider) {
            throw new Error('Missing provider');
        }
        if (!signerManager) {
            throw new Error('Missing signer manager');
        }
        if (!cancelManager) {
            throw new Error('Missing task manager');
        }
        if (!policyManager) {
            throw new Error('Missing policy manager');
        }
        if (!requests) {
            throw new Error('Missing looksrare requests module');
        }
        this._debug = debug !== false;
        this._prov = provider;
        this._sm = signerManager;
        this._pm = policyManager;
        this._cm = cancelManager;
        this._req = requests;
    }

    async frontrunSaleTx(saleTx) {
        if (!saleTx) {
            throw new Error('Missing tx');
        }

        // Parse transaction
        const hash = saleTx.hash;
        const maxFee = saleTx.maxFeePerGas || saleTx.gasPrice;
        const prioFee = saleTx.maxPriorityFeePerGas;
        const baseFee = await getBaseFee(this._prov);
        const orders = this.parseTx(saleTx);

        // Check if transaction matches known policies and add to task manager
        for (const order of orders) {
            if (this._pm.hasActive(order.token)) {
                const policy = this._pm.get(order.token);
                this._cm.add(policy.user, order, baseFee, maxFee, prioFee);
            }
            else {
                console.log(hash + ' ' + order.token.tokenId + ' (' + order.nonce + ') did not match any active policies');
            }
        }

        // Get updated cancel transactions to send
        const bundle = await this._cm.getTxs(baseFee);
        const notifs = [];

        // Make sure cancel transaction don't exceed insurance policies
        const cancelBundle = [];
        for (const { user, listings, transaction } of bundle) {
            const tokens = listings.map(l => l.token);
            const insurance = this._pm.getInsurance(tokens);
            const cost = getTxCost(transaction);
            if (cost.gt(insurance)) {
                notifs.push(notifyTx(user, tokens, true, 'Insurance policy too low for ' + ethers.utils.formatEther(txFee) + 'Ξ', hash))
                console.log(user + ' failed to cuck because insurance too low for ' + ethers.utils.formatEther(txFee) + 'Ξ');
                console.log(JSON.stringify(listings, null, 2));
                console.log(printTx(transaction));
            }
            else {
                cancelBundle.push({ user, transaction, tokens });
            }
        }

        // Send transactions and record successes/fails
        const notifyTx = this._notifyTx;
        const debug = this._debug;
        const sm = this._sm;
        await Promise.all(cancelBundle.map(({ user, transaction, tokens }) => (async () => {
            const signer = sm.get(user);
            let success;
            if (debug) {
                console.log('Simulating cancel tx, frontrunning ' + hash + '...');
                console.log(printTx(transaction));
                success = await simulate(signer.provider, transaction);
            }
            else {
                console.log('Sending cancel tx, frontrunning ' + hash + '...');
                console.log(printTx(cancelTx));
                success = await send(signer, transaction);
            }

            if (success) {
                console.log(hash + ' successfully frontran!');
                notifs.push(notifyTx(user, tokens, true, null, hash));
            }
            else {
                console.log(hash + ' failed to frontrun!');
                notifs.push(notifyTx(user, tokens, false, null, hash));
            }

            for (const token of tokens) {
                this._pm.stop(token);
            }
        })()));

        await Promise.all(notifs);
    }

    parseTx(tx) {
        // return {
        //     tokenContract: '0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258',
        //     tokenId: 81312,
        //     listingNonce: 23,
        // };
        try {
            const { args, name } = decodeTx(IFACE, tx);
            switch (name) {
                case 'matchAskWithTakerBidUsingETHAndWETH':
                case 'matchAskWithTakerBid': {
                    const takerBid = args[0];
                    const makerAsk = args[1];
                    return [new Listing(
                        new Token(
                            makerAsk[2], 
                            takerBid[3].toString()
                        ), 
                        makerAsk[8].toString()
                    )];
                }
                case 'batchBuyWithETH': {
                    const orders = [];

                    // Gem regular buy on looksrare
                    const tradeDetails = args[0];
                    for (const tradeDetail of tradeDetails) {
                        // Ensure that correct proxy is being called
                        if (tradeDetail.marketId.toString() !== '16') {
                            continue;
                        }

                        // Ensure the correct function on proxy is being called
                        const td = tradeDetail.tradeData.toString();
                        const tdHash = td.substring(0, 10).toLowerCase();
                        if (tdHash !== '0xf3e81623') {
                            continue;
                        }

                        // Split into array of 64-length params
                        const tdParams = td.substring(10).match(/.{1,64}/g);

                        // Parse individual sales
                        for (let i = 3; i < tdParams.length; i += 13) {
                            orders.push(new Listing(
                                new Token(
                                    '0x' + tdParams[i + 12].substring(24), 
                                    ethers.BigNumber.from('0x' + tdParams[i + 2]).toString()
                                ), 
                                ethers.BigNumber.from('0x' + tdParams[i + 4]).toString()
                            ));
                        }
                    }

                    return orders;
                }
                case 'matchBidWithTakerAsk': // Looksrare accept bid
                case 'batchBuyWithERC20s':
                default: return [];
            }
        }
        catch (err) {
            console.log('Failed to parse tx: ' + err.message);
            console.log(err.stack);
            return [];
        }
    }

    async _notifyTx(user, tokens, success, description, targetHash, cancelHash) {
        if (!user || !tokens || success == null) {
            throw new Error('Missing required parameters');
        }

        let tokenIds = tokens[0].tokenId;
        let listings = '[' + tokens[0].tokenId + '](https://looksrare.org/collections/' + tokens[0].address + '/' + tokens[0].tokenId + ')';
        for (let i = 1; i < tokens.length; ++i) {
            tokenIds += ', ' + tokens[i].tokenId;
            listings += '\n' + '[' + tokens[i].tokenId + '](https://looksrare.org/collections/' + tokens[i].address + '/' + tokens[i].tokenId + ')';
        }

        await notify(
            user + (success ? ' successfully cucked sale of token ' : ' failed to cuck sale of token ') + tokenIds, 
            cancelHash ? 'https://etherscan.io/tx/' + cancelHash : null,
            (description ? description + '\n' : '') + 
            (targetHash ? '[**Cucked Tx**](https://etherscan.io/tx/' + targetHash + ')\n' : '') +
            listings,
            success ? 0x0BDA51 : 0xC70039,
        );
    }

    _printDebug(decoded) {
        const decoded2 = [];
        for (let j = 0; j < decoded.length; ++j) {
            let tuple = decoded[j];
            let tuple2 = [];
            for (let i = 0; i < tuple.length; ++i) {
                if (tuple[i]._isBigNumber) {
                    const converted = ethers.BigNumber.from(tuple[i]).toString();
                    tuple2.push(converted);
                }
                else {
                    tuple2.push(tuple[i]);
                }
            }
            decoded2.push(tuple2);
        }
        console.log(JSON.stringify(decoded2, null, 2));
    }
}

module.exports = FarmingController;