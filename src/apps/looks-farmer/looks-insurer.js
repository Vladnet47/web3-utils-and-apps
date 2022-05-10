const { ethers } = require("ethers");
const { getNftyHttpsProv, isNumeric, getTxCost, createTx, encodeTxData, printTx, send, simulate, notify, RequestModule } = require("../../utils")

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
        this._policies = new Map();
        this._pks = pks;
        this._signers = new Map();
        this._req = new RequestModule(true);
    }

    get signers() {
        return Array.from(this._signers.keys());
    }

    get policies() {
        return Array.from(this._policies.values());
    }

    async load() {
        const prov = await getNftyHttpsProv();
        const cont = new ethers.Contract(LOOKS_ADDRESS, LOOKS_IFACE, prov);
        for (const [name, pk] of Object.entries(this._pks)) {
            if (!name || !pk) {
                throw new Error('Missing private key name or pk');
            }
            const signer = new ethers.Wallet(pk, prov);
            const contractSigner = cont.connect(signer);
            this._signers.set(name.toLowerCase(), contractSigner);
        }
        console.log('Created ' + this._signers.size + ' signers from configs');
        await this._req.load();
    }

    addPolicy(owner, tokenContract, tokenId, maxInsurance) {
        if (!owner) {
            throw new Error('Missing owner');
        }
        if (!tokenContract) {
            throw new Error('Missing token contract');
        }
        if (tokenId == null || !isNumeric(tokenId)) {
            throw new Error('Missing token id');
        }
        if (!maxInsurance) {
            throw new Error('Missing max insurance');
        }
        if (!this._signers.has(owner.toLowerCase())) {
            throw new Error('Missing signer for ' + owner);
        }

        const ownerAddress = this._signers.get(owner.toLowerCase()).signer.address;

        const id = this.toId(ownerAddress, tokenContract, tokenId);
        this._policies.set(id, {
            owner: owner.toLowerCase(),
            ownerAddress: ownerAddress.toLowerCase(),
            tokenContract: tokenContract.toLowerCase(),
            tokenId,
            maxInsurance: ethers.utils.parseUnits(maxInsurance.toString()),
            running: true,
        });

        console.log('Updated ' + id + ' with max insurance ' + maxInsurance);
    }

    removePolicy(owner, tokenContract, tokenId) {
        if (!owner) {
            throw new Error('Missing owner');
        }
        if (!tokenContract) {
            throw new Error('Missing token contract');
        }
        if (tokenId == null || !isNumeric(tokenId)) {
            throw new Error('Missing token id');
        }
        if (!this._signers.has(owner.toLowerCase())) {
            throw new Error('Missing signer for ' + owner);
        }
        const ownerAddress = this._signers.get(owner.toLowerCase()).signer.address;
        const id = this.toId(ownerAddress, tokenContract, tokenId);
        this._policies.delete(id);
    }

    async handleTx(tx) {
        if (!tx || !tx.data) {
            throw new Error('Missing tx or tx data');
        }
        if (!tx.gasPrice && !tx.maxFeePerGas) {
            throw new Error('Tx missing max fee');
        }

        // Get token information
        const { from, tokenId, tokenContract } = this.parseCalldata(tx.data);
        if (!from || !tokenContract || !tokenId) {
            console.log('Tx ' + tx.hash + ' is not a sale');
            return;
        }

        // Check if token is ensured
        const id = this.toId(from, tokenContract, tokenId);
        if (!this._policies.has(id)) {
            console.log('Tx ' + tx.hash + ' is not targeting any ensured tokens');
            return;
        }

        const { maxInsurance, owner, running } = this._policies.get(id);
        if (!running) {
            console.log('Tx ' + tx.hash + ' policy is not running');
        }

        const signer = this._signers.get(owner);

        // Get signer nonce
        const [nonce, { listingNonce }] = await Promise.all([
            signer.signer.getTransactionCount(),
            this.getListingDetails(tokenContract, tokenId)
        ]);

        // Create cancel transaction to frontrun the purchase
        const frontrunFee = ethers.utils.parseUnits('1', 'gwei');
        const prioFee = tx.maxPriorityFeePerGas ? tx.maxPriorityFeePerGas.add(frontrunFee) : tx.gasPrice.add(frontrunFee);
        const tempMaxFee = (tx.maxFeePerGas || tx.gasPrice).add(frontrunFee);
        const maxFee = tempMaxFee.gte(prioFee) ? tempMaxFee : prioFee;
        const cancelTx = createTx(
            LOOKS_ADDRESS, 
            ethers.utils.formatUnits(maxFee, 'gwei'), 
            ethers.utils.formatUnits(prioFee, 'gwei'), 
            GAS_LIMIT, 
            null, 
            encodeTxData(CANCEL_FN, [[listingNonce]]), 
            nonce, 
            tx.type
        );

        // Make sure insurance fee is acceptable
        const txFee = await getTxCost(cancelTx);
        if (txFee.gt(maxInsurance)) {
            console.log('Transaction fee for cancellation is greater than insurance policy!');
            console.log(printTx(cancelTx));
            await notify(
                owner + ' failed to cuck sale of token ' + tokenId, 
                'https://etherscan.io/tx/' + tx.hash,
                'Insurance policy was not set high enough for ' + ethers.utils.formatEther(txFee) + 'Ξ\n' +
                '[Listing](https://looksrare.org/collections/' + tokenContract + '/' + tokenId + ')',
                0xC70039
            );
            return;
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
            success = await send(signer.signer, cancelTx);
        }

        // Stop policy
        this._policies.set(id, { ...this._policies.get(id), running: false });

        if (success) {
            await notify(
                owner + ' successfully cucked sale of token ' + tokenId, 
                'https://etherscan.io/tx/' + tx.hash,
                'Used max ' + ethers.utils.formatEther(txFee) + 'Ξ\n' +
                '[Listing](https://looksrare.org/collections/' + tokenContract + '/' + tokenId + ')',
                0x0BDA51
            );
        }
        else {
            await notify(
                owner + ' failed to cuck sale of token ' + tokenId, 
                'https://etherscan.io/tx/' + tx.hash,
                'Used max ' + ethers.utils.formatEther(txFee) + 'Ξ\n' +
                '[Listing](https://looksrare.org/collections/' + tokenContract + '/' + tokenId + ')',
                0xC70039
            );
        }
    }

    parseCalldata(calldata) {
        // return {
        //     from: '0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C2d', 
        //     tokenContract: '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', 
        //     tokenId: 81312
        // };
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
            const takerBid = decoded[0];
            const makerAsk = decoded[1];
            return {
                to: takerBid[1],
                from: makerAsk[1],
                tokenContract: makerAsk[2],
                tokenId: takerBid[3],
            };
        }
        else if (calldata.startsWith('0x3b6d032e')) {
            const decoded = LOOKS_IFACE.decodeFunctionData('matchBidWithTakerAsk', calldata);
            const takerBid = decoded[0];
            const makerAsk = decoded[1];
            return {
                to: makerAsk[1],
                from: takerBid[1],
                tokenContract: makerAsk[2],
                tokenId: takerBid[3],
            };
        }
        else {
            return {};
        }
    }

    async getListingDetails(tokenContract, tokenId) {
        if (!tokenContract || tokenId == null) {
            throw new Error('Missing token contract or id');
        }

        const url = 'https://api.looksrare.org/graphql';

        const headers = {
            'authority': 'api.looksrare.org',
            'method': 'POST',
            'path': '/graphql',
            'scheme': 'https',
            'accept': '*/*',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'dnt': '1',
            'origin': 'https://looksrare.org',
            'referer': 'https://looksrare.org/',
            'sec-ch-ua': '"Not A;Brand";v="99", "Chromium";v="101", "Google Chrome";v="101"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36'
        };

        const body = {
            query: "\n    query GetToken($collection: Address!, $tokenId: String!) {\n      token(collection: $collection, tokenId: $tokenId) {\n        id\n        tokenId\n        image {\n          src\n          contentType\n        }\n        name\n        countOwners\n        description\n        animation {\n          src\n          contentType\n          original\n        }\n        lastOrder {\n          price\n          currency\n        }\n        collection {\n          name\n          address\n          type\n          isVerified\n          points\n          totalSupply\n          description\n          owner {\n            ...CollectionOwnerFragment\n          }\n          floorOrder {\n            price\n          }\n          floor {\n            floorPriceOS\n            floorPrice\n            floorChange24h\n            floorChange7d\n            floorChange30d\n          }\n        }\n        ask {\n          ...OrderFragment\n        }\n        attributes {\n          ...AttributeFragment\n        }\n      }\n    }\n    \n  fragment AttributeFragment on Attribute {\n    traitType\n    value\n    displayType\n    count\n    floorOrder {\n      price\n    }\n  }\n\n    \n  fragment OrderFragment on Order {\n    isOrderAsk\n    signer\n    collection {\n      address\n    }\n    price\n    amount\n    strategy\n    currency\n    nonce\n    startTime\n    endTime\n    minPercentageToAsk\n    params\n    signature\n    token {\n      tokenId\n    }\n    hash\n  }\n\n    \n  fragment CollectionOwnerFragment on User {\n    address\n    name\n    isVerified\n    avatar {\n      id\n      tokenId\n      image {\n        src\n        contentType\n      }\n    }\n  }\n\n  ",
            variables: {
                collection: tokenContract.toString(),
                tokenId: tokenId.toString()
            }
        };
        
        try {
            const res = await this._req.post(url, body, headers, 'json');
            if (res && res.data && res.data.token) {
                return {
                    floorPrice: ethers.utils.parseEther(res.data.token.collection.floorOrder.price),
                    floorPriceOS: ethers.utils.parseEther(res.data.token.collection.floor.floorPriceOS),
                    price: ethers.utils.parseEther(res.data.token.ask.price),
                    listingNonce: res.data.token.ask.nonce,
                };
            }

            return {};
        }
        catch (err) {
            console.log('Failed to retrieve listing details from looksrare: ' + err.message);
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