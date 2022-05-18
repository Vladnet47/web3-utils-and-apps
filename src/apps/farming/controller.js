const { ethers } = require('ethers');
const { getTxCost, printTx, send, simulate, notify, decodeTx, getBaseFee } = require('../../utils');
const { Purchase, Token } = require('./objects');

const IFACE = new ethers.utils.Interface([
    'function matchAskWithTakerBidUsingETHAndWETH((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchAskWithTakerBid((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchBidWithTakerAsk((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function batchBuyFromOpenSea(tuple(uint256 value, bytes tradeData)[] openseaTrades) payable',
    'function batchBuyWithETH(tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails) payable',
    'function batchBuyWithERC20s(tuple(address[] tokenAddrs, uint256[] amounts) erc20Details, tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails, tuple(bytes conversionData)[] converstionDetails, address[] dustTokens) payable',
]);

class FarmingController {
    constructor(provider, signerManager, cancelManager, looksRequests, debug) {
        if (!provider) {
            throw new Error('Missing provider');
        }
        if (!signerManager) {
            throw new Error('Missing signer manager');
        }
        if (!cancelManager) {
            throw new Error('Missing task manager');
        }
        if (!looksRequests) {
            throw new Error('Missing looksrare requests module');
        }
        this._debug = debug !== false;
        this._prov = provider;
        this._sm = signerManager;
        this._cm = cancelManager;
        this._req = looksRequests;
        this._baseFee = null;
    }

    async syncBaseFee(baseFee) {
        if (!baseFee || !baseFee._isBigNumber) {
            const block = await this._prov.getBlock('latest');
            if (!block) {
                throw new Error('Failed to retrieve block');
            }
            this._baseFee = block.baseFeePerGas;
        }
        else {
            this._baseFee = baseFee;
        }
        console.log('Updated base fee ' + ethers.utils.formatUnits(this._baseFee, 'gwei'));
    }

    async frontrunSaleTx(saleTx) {
        if (!saleTx) {
            throw new Error('Missing tx');
        }
        if (!this._baseFee) {
            await this.syncBaseFee();
        }

        // Parse transaction
        const hash = saleTx.hash;
        const maxFee = saleTx.maxFeePerGas || saleTx.gasPrice;
        const prioFee = saleTx.maxPriorityFeePerGas;
        const baseFee = this._baseFee;
        const orders = this.parseTx(saleTx);
        const notifyTx = this._notifyTx;
        const debug = this._debug;

        console.log(hash + ' checking tx');

        // Check if transaction matches known policies and add to task manager
        let addedAtLeastOne = false;
        for (const order of orders) {
            if (this._cm.hasActivePolicy(order.token)) {
                addedAtLeastOne = this._cm.addRequest(order, baseFee, maxFee, prioFee);
            }
            else {
                console.log(hash + ' ' + order.token.id + ' (' + order.nonce + ') did not match any active policies');
            }
        }
        if (!addedAtLeastOne) {
            return;
        }

        // Get updated cancel transactions to send
        const bundle = this._cm.getRequestTxs(baseFee);
        const notifs = [];

        // Make sure cancel transaction don't exceed insurance policies
        const cancelBundle = [];
        for (const { user, listings, transaction } of bundle) {
            const tokens = listings.map(l => l.token);
            const insurance = this._cm.getInsurance(tokens);
            const balance = this._sm.getBalance(user);
            const cost = getTxCost(transaction);
            if (cost.gt(insurance)) {
                notifs.push(notifyTx(this._sm.getName(user), tokens, false, 'Insurance policy too low: ' + ethers.utils.formatEther(cost) + 'Ξ > ' + ethers.utils.formatEther(insurance) + 'Ξ', hash))
                console.log(user + ' failed to cuck because insurance too low: ' + ethers.utils.formatEther(cost) + 'Ξ > ' + ethers.utils.formatEther(insurance) + 'Ξ');
                console.log('Listings: ' + JSON.stringify(listings, null, 2));
                console.log('Transaction:');
                printTx(transaction)
            }
            else if (cost.gt(balance)) {
                notifs.push(notifyTx(this._sm.getName(user), tokens, false, 'Wallet balance too low: ' + ethers.utils.formatEther(cost) + 'Ξ > ' + ethers.utils.formatEther(balance) + 'Ξ', hash))
                console.log(user + ' failed to cuck because wallet balance too low: ' + ethers.utils.formatEther(cost) + 'Ξ > ' + ethers.utils.formatEther(balance) + 'Ξ');
                console.log('Listings: ' + JSON.stringify(listings, null, 2));
                console.log('Transaction:');
                printTx(transaction)
            }
            else {
                cancelBundle.push({ user, transaction, tokens });
            }
        }

        // Send transactions and record successes/fails
        const sm = this._sm;
        const cm = this._cm;
        await Promise.all(cancelBundle.map(({ user, transaction, tokens }) => (async () => {
            const signer = sm.getSigner(user);
            let success;
            if (debug) {
                console.log('Simulating cancel tx, frontrunning ' + hash + '...');
                console.log('Transaction:');
                printTx(transaction)
                success = await simulate(signer.provider, transaction);
            }
            else {
                console.log('Sending cancel tx, frontrunning ' + hash + '...');
                console.log('Transaction:');
                printTx(transaction)
                success = await send(signer, transaction);
            }

            if (success) {
                console.log(hash + ' successfully frontran!');
                notifs.push(notifyTx(sm.getName(user), tokens, true, null, hash));
            }
            else {
                console.log(hash + ' failed to frontrun!');
                notifs.push(notifyTx(sm.getName(user), tokens, false, null, hash));
            }

            for (const token of tokens) {
                cm.stopPolicy(token);
                cm.removeRequest(token);
            }
        })()));

        await Promise.all(notifs);
    }

    parseTx(tx) {
        try {
            const { args, name } = decodeTx(IFACE, tx);
            switch (name) {
                case 'matchAskWithTakerBidUsingETHAndWETH':
                case 'matchAskWithTakerBid': {
                    const takerBid = args[0];
                    const makerAsk = args[1];
                    return [new Purchase(
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
                            orders.push(new Purchase(
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
            //console.log('Failed to parse tx: ' + err.message);
            //console.log(err.stack);
            return [];
        }
    }

    async _notifyTx(user, tokens, success, description, targetHash, cancelHash) {
        if (!user || !tokens || success == null) {
            throw new Error('Missing required parameters');
        }

        let tokenIds = tokens[0].id;
        let listings = '[' + tokens[0].id + '](https://looksrare.org/collections/' + tokens[0].address + '/' + tokens[0].id + ')';
        for (let i = 1; i < tokens.length; ++i) {
            tokenIds += ', ' + tokens[i].id;
            listings += '\n' + '[' + tokens[i].id + '](https://looksrare.org/collections/' + tokens[i].address + '/' + tokens[i].id + ')';
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