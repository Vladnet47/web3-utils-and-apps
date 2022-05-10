const { ethers } = require("ethers");
const { getNftyHttpsProv, isNumeric, getTxCost, createTx, encodeTxData, printTx, send, simulate, notify } = require("../../utils")

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a';
const CANCEL_FN = 'function cancelMultipleMakerOrders(uint256[] orderNonces) payable returns()';
const LOOKS_IFACE = new ethers.utils.Interface([
    'function matchAskWithTakerBidUsingETHAndWETH((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchAskWithTakerBid((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchBidWithTakerAsk((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()'
]);
const GAS_LIMIT = 70000;

class LooksEnsurer {
    constructor(pks, debug) {
        if (!pks) {
            throw new Error('Missing private keys');
        }

        this._debug = debug !== false;
        this._tokens = new Map();
        this._signers = new Map();

        const prov = await getNftyHttpsProv();
        const cont = new ethers.Contract(LOOKS_ADDRESS, LOOKS_IFACE, prov);
        for (const [name, pk] of Object.entries(pks)) {
            if (!name || !pk) {
                throw new Error('Missing private key name or pk');
            }
            const signer = new ethers.Wallet(pk, prov);
            const address = signer.address;
            const contractSigner = cont.connect(signer);
            this._signers.set(address.toLowerCase(), contractSigner);
        }
    }

    async addToken(owner, tokenContract, tokenId, listingNonce, maxInsurance) {
        if (!owner) {
            throw new Error('Missing owner');
        }
        if (!tokenContract) {
            throw new Error('Missing token contract');
        }
        if (tokenId == null || !isNumeric(tokenId)) {
            throw new Error('Missing token id');
        }
        if (listingNonce == null) {
            throw new Error('Missing listing nonce');
        }
        if (!maxInsurance) {
            throw new Error('Missing max insurance');
        }
        if (!this._signers.has(owner.toLowerCase())) {
            throw new Error('Missing signer for ' + owner);
        }

        const id = this.toId(owner, tokenContract, tokenId);
        this._tokens.set(id, { 
            listingNonce: parseInt(listingNonce),
            maxInsurance: ethers.utils.parseUnits(maxInsurance),
        });
        console.log('Updated ' + id + ' for nonce ' + listingNonce + ' and max insurance ' + maxInsurance);
    }

    handleTx(tx) {
        if (!tx || !tx.data) {
            throw new Error('Missing tx or tx data');
        }
        if (!tx.gasPrice && !tx.maxFeePerGas) {
            throw new Error('Tx missing max fee');
        }

        // Get token information
        const { to, from, tokenId, tokenContract } = this.parseCalldata(tx.data);
        if (!from || !tokenContract || !tokenId) {
            return null;
        }

        // Check if token is ensured
        const id = this.toId(from, tokenContract, tokenId);
        if (!this._tokens.has(id)) {
            return null;
        }

        // Get signer nonce
        const signer = this._signers.get(from.toLowerCase());
        const nonce = await signer.getTransactionCount();

        // Create cancel transaction to frontrun the purchase
        const { maxInsurance, listingNonce } = this._tokens.get(id);
        const prioFee = tx.maxPriorityFeePerGas ? tx.maxPriorityFeePerGas.add(1) : tx.gasPrice.add(1);
        const tempMaxFee = tx.maxFeePerGas || tx.gasPrice;
        const maxFee = tempMaxFee.gte(prioFee) ? tempMaxFee : prioFee;
        const cancelTx = createTx(LOOKS_ADDRESS, maxFee, prioFee, GAS_LIMIT, null, encodeTxData(CANCEL_FN, [listingNonce]), nonce, tx.type);

        // Make sure insurance fee is acceptable
        const txFee = await getTxCost(cancelTx);
        if (txFee.gt(maxInsurance)) {
            console.log('Transaction fee for cancellation is greater than insurance policy!');
            console.log(printTx(cancelTx));
            await notify(
                from + ' failed to cuck ' + to + ' for token ' + tokenId, 
                'https://etherscan.io/tx/' + tx.hash,
                'Insurance policy was not set high enough for ' + ethers.utils.formatEther(txFee) + 'Ξ',
                0xC70039
            );
            return;
        }

        // Send cancellation tx
        let success;
        if (this._debug) {
            console.log('Simulating cancel tx, frontrunning ' + tx.hash + '...');
            console.log(printTx(cancelTx));
            success = await simulate(signer, tx);
        }
        else {
            console.log('Sending cancel tx, frontrunning ' + tx.hash + '...');
            console.log(printTx(cancelTx));
            success = await send(signer, cancelTx);
        }

        if (success) {
            await notify(
                from + ' successfully cucked ' + to + ' for token ' + tokenId, 
                'https://etherscan.io/tx/' + tx.hash,
                'Used ' + ethers.utils.formatEther(txFee) + 'Ξ',
                0x0BDA51
            );
        }
        else {
            await notify(
                from + ' failed to cuck ' + to + ' for token ' + tokenId, 
                'https://etherscan.io/tx/' + tx.hash,
                'Used ' + ethers.utils.formatEther(txFee) + 'Ξ',
                0xC70039
            );
        }
    }

    parseCalldata(calldata) {
        if (!calldata) {
            throw new Error('Missing calldata');
        }
        else if (calldata.startsWith('0xb4e4b296')) {
            const decoded = LOOKS_IFACE.decodeFunctionData('matchAskWithTakerBidUsingETHAndWETH', calldata);
            const takerBid = decoded[0];
            const makerAsk = decoded[1];
            return {
                to: takerBid[1],
                from: makerAsk[1],
                tokenContract: makerAsk[2],
                tokenId: takerBid[3],
            };
        }
        else if (calldata.startsWith('0x38e29209')) {
            const decoded = LOOKS_IFACE.decodeFunctionData('matchAskWithTakerBid', calldata);
            console.log('matchAskWithTakerBid');
            console.log(JSON.stringify(decoded, null, 2));
        }
        else if (calldata.startsWith('0x3b6d032e')) {
            const decoded = LOOKS_IFACE.decodeFunctionData('matchBidWithTakerAsk', calldata);
            console.log('matchBidWithTakerAsk');
            console.log(JSON.stringify(decoded, null, 2));
        }
        else {
            return {};
        }
    }

    toId(owner, tokenContract, tokenId) {
        return owner.toLowerCase() + '_' + tokenContract.toLowerCase() + '_' + tokenId;
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

module.exports = LooksEnsurer;