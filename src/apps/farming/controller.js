const { ethers } = require('ethers');
const { getTxCost, createTx, printTx, send, simulate, notify, decodeTx, getAddressDetails, getFrontrunFee } = require('../../utils');

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a'.toLowerCase();
const IFACE = new ethers.utils.Interface([
    'function matchAskWithTakerBidUsingETHAndWETH((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchAskWithTakerBid((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchBidWithTakerAsk((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function batchBuyFromOpenSea(tuple(uint256 value, bytes tradeData)[] openseaTrades) payable',
    'function batchBuyWithETH(tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails) payable',
    'function batchBuyWithERC20s(tuple(address[] tokenAddrs, uint256[] amounts) erc20Details, tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails, tuple(bytes conversionData)[] converstionDetails, address[] dustTokens) payable',
]);
const LOOKS_IFACE = new ethers.utils.Interface(['function cancelMultipleMakerOrders(uint256[] orderNonces) payable returns()']);
const GAS_LIMIT = 70000;

class FarmingController {
    constructor(signerManager, policyManager, requests, debug) {
        if (!signerManager) {
            throw new Error('Missing signer manager');
        }
        if (!policyManager) {
            throw new Error('Missing policy manager');
        }
        if (!requests) {
            throw new Error('Missing looksrare requests module');
        }
        this._debug = debug !== false;
        this._pm = policyManager;
        this._sm = signerManager;
        this._req = requests;
    }

    async frontrunSaleTx(tx) {
        // Parse transaction data
        const { from, tokenId, tokenContract, listingNonce } = this.parseTx(tx);
        if (!from) {
            throw new Error('Not an applicable sale');
        }
        if (!this._pm.hasActive(from, tokenContract, tokenId)) {
            throw new Error('No active policies matched');
        }
        const { insurance } = this._pm.get(from, tokenContract, tokenId);

        // Build cancel transaction
        const signer = this._sm.get(from);
        const { maxFee, prioFee } = getFrontrunFee(tx.maxFeePerGas || tx.gasPrice, tx.maxPriorityFeePerGas);
        const { balance, nonce } = await getAddressDetails(signer.provider, signer.address);
        const cancelTx = createTx(
            LOOKS_ADDRESS, 
            ethers.utils.formatUnits(maxFee, 'gwei'), 
            ethers.utils.formatUnits(prioFee, 'gwei'), 
            GAS_LIMIT,
            null, 
            LOOKS_IFACE.encodeFunctionData('cancelMultipleMakerOrders', [[listingNonce]]), 
            nonce, 
            tx.type
        );

        // Make sure insurance fee is acceptable
        const txFee = getTxCost(cancelTx);
        if (txFee.gt(insurance)) {
            await this._notifyTx(from, tokenContract, tokenId, false, 'Insurance policy too low for ' + ethers.utils.formatEther(txFee) + 'Ξ');
            throw new Error('Insurance policy too low');
        }
        else if (txFee.gt(balance)) {
            await this._notifyTx(from, tokenContract, tokenId, false, 'Wallet balance too low for ' + ethers.utils.formatEther(txFee) + 'Ξ');
            throw new Error('Wallet balance too low');
        }

        // Send cancellation tx
        let success;
        if (this._debug) {
            console.log('Simulating cancel tx, frontrunning ' + tx.hash + '...');
            console.log(printTx(cancelTx));
            success = await simulate(signer.provider, cancelTx);
        }
        else {
            console.log('Sending cancel tx, frontrunning ' + tx.hash + '...');
            console.log(printTx(cancelTx));
            success = await send(signer, cancelTx);
        }

        this._pm.stop(from, tokenContract, tokenId);

        if (success) {
            console.log(tx.hash + ' successfully frontran!');
            console.log(printTx(cancelTx));
            await this._notifyTx(from, tokenContract, tokenId, true, 'Projected fees: ' + ethers.utils.formatEther(txFee) + 'Ξ', tx.hash, cancelTx.hash);
        }
        else {
            console.log(tx.hash + ' failed to frontrun!');
            console.log(printTx(cancelTx));
            await this._notifyTx(from, tokenContract, tokenId, false, 'Projected fees: ' + ethers.utils.formatEther(txFee) + 'Ξ', tx.hash, cancelTx.hash);
        }
    }

    parseTx(tx) {
        return {
            from: '0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C2d',
            tokenContract: '0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258',
            tokenId: 81312,
            listingNonce: 23,
        };
        try {
            const { args, name } = decodeTx(IFACE, tx);
            switch (name) {
                case 'matchAskWithTakerBidUsingETHAndWETH': {
                    // Looksrare regular buy
                    const takerBid = args[0];
                    const makerAsk = args[1];
                    return {
                        to: takerBid[1],
                        from: makerAsk[1],
                        tokenContract: makerAsk[2],
                        tokenId: takerBid[3].toString(),
                        listingNonce: makerAsk[8].toString(),
                    };
                }
                case 'matchAskWithTakerBid': {
                    // Looksrare buy
                    const takerBid = args[0];
                    const makerAsk = args[1];
                    return {
                        to: takerBid[1],
                        from: makerAsk[1],
                        tokenContract: makerAsk[2],
                        tokenId: takerBid[3].toString(),
                        listingNonce: makerAsk[8].toString(),
                    };
                }
                case 'matchBidWithTakerAsk': {
                    // This represents an offer that has been accepted by owner. Don't frontrun this
                    const takerBid = args[0];
                    const makerAsk = args[1];
                    return {
                        // to: makerAsk[1],
                        // from: takerBid[1],
                        // tokenContract: makerAsk[2],
                        // tokenId: takerBid[3].toString(),
                        // listingNonce: makerAsk[8].toString(),
                    };
                }
                case 'batchBuyWithETH': {
                    // Gem regular buy on looksrare
                    this._printDebug(args);

                    return {
                        // to: makerAsk[1],
                        // from: takerBid[1],
                        // tokenContract: makerAsk[2],
                        // tokenId: takerBid[3],
                        // listingNonce: makerAsk[8],
                    };
                }
                case 'batchBuyWithERC20s': {
                    this._printDebug(args);

                    return {
                        // to: makerAsk[1],
                        // from: takerBid[1],
                        // tokenContract: makerAsk[2],
                        // tokenId: takerBid[3],
                        // listingNonce: makerAsk[8],
                    };
                }
                default: return {};
            }
        }
        catch (err) {
            return {};
        }
    }

    async _notifyTx(user, contract, tokenId, success, description, targetHash, cancelHash) {
        if (!user || !contract || tokenId == null || success == null) {
            throw new Error('Missing required parameters');
        }
        await notify(
            user + (success ? ' successfully cucked sale of token ' : ' failed to cuck sale of token ') + tokenId, 
            cancelHash ? 'https://etherscan.io/tx/' + cancelHash : null,
            (description ? description + '\n' : '') + 
            (targetHash ? '[**Cucked Tx**](https://etherscan.io/tx' + targetHash + ')\n' : '') +
            '[Listing](https://looksrare.org/collections/' + contract + '/' + tokenId + ')',
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