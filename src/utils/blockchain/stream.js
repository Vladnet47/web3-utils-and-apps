const ethers = require('ethers');
const ws = require('ws');
const common = require('./common');
const file = require('../file');

// Starts monitoring pending txs from provided address.
// Whenever encountered, calls callback.
// Uses alchemy ws provider.
async function streamPendingTxs(address, callback) {
    if (!callback) {
        throw new Error('Missing callback');
    }
    if (!address) {
        throw new Error('Missing address');
    }
    const endpoint = (await file.readConfigs()).endpoints.alchemy;
    const webs = new ws.WebSocket('wss://' + endpoint);

    webs.on('open', () => webs.send(JSON.stringify(
        { jsonrpc: '2.0', id: 1, method: 'eth_subscribe', params: ['alchemy_filteredNewFullPendingTransactions', { address }] }
    )));

    webs.on('message', async txStr => {
        if (txStr) {
            const json = JSON.parse(txStr.toString());
            if (json.params.result) {
                const tx = json.params.result;
                await callback({
                    ...tx,
                    data: tx.input != null ? tx.input : tx.data,
                    value: tx.value ? ethers.BigNumber.from(tx.value) : null,
                    gasPrice: tx.gasPrice ? ethers.BigNumber.from(tx.gasPrice) : null,
                    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.BigNumber.from(tx.maxPriorityFeePerGas) : null,
                    maxFeePerGas: tx.maxFeePerGas ? ethers.BigNumber.from(tx.maxFeePerGas) : null,
                    gasLimit: tx.gas ? parseInt(tx.gas, 16) : null,
                    type: parseInt(tx.type, 16),
                    chainId: parseInt(tx.chainId, 16),
                    nonce: parseInt(tx.nonce, 16),
                    v: parseInt(tx.v, 16)
                });
            }
        }
    });

    return webs.close;
}

// Starts monitoring new block numbers.
// Whenever encountered, calls callback.
// Uses zmok http provider.
async function streamBlocks(callback, chainId) {
    if (!callback) {
        throw new Error('Missing callback');
    }

    const prov = await common.getZmokHttpProv(chainId);
    prov.on('block', async bn => {
        if (bn) {
            try {
                await callback(bn);
            }
            catch (err) {
                console.log('Callback failed: ' + err.message);
                console.log(err.stack);
            }
        }
    });

    console.log('Started monitoring block numbers');
    return prov.destroy;
}

// Starts monitoring new full blocks.
// Whenever encountered, calls callback.
// Uses alchemy http provider.
async function streamFullBlocks(callback, chainId) {
    if (!callback) {
        throw new Error('Missing callback');
    }

    const prov = await common.getAlchemyHttpProv(chainId);
    prov.on('block', async bn => {
        if (bn) {
            let block;
            try {
                block = await prov.getBlock(bn);
            }
            catch (err) {
                console.log('Failed to retrieve full block: ' + err.message);
                return;
            }

            try {
                await callback(block);
            }
            catch (err) {
                console.log('Callback failed: ' + err.message);
                console.log(err.stack);
            }
        }
    });

    console.log('Started monitoring full blocks');
    return prov.destroy;
}

// Starts monitoring confirmed txs.
// Whenever encountered, calls callback.
// Uses alchemy http provider.
async function streamConfirmedTxs(address, callback, chainId) {
    if (!callback) {
        throw new Error('Missing callback');
    }
    if (!address) {
        throw new Error('Missing address');
    }
    const prov = common.getAlchemyHttpProv(chainId);

    prov.on({ address }, async tx => {
        if (tx) {
            await callback({
                ...tx,
                value: tx.value ? ethers.BigNumber.from(tx.value) : null,
                gasPrice: tx.gasPrice ? ethers.BigNumber.from(tx.gasPrice) : null,
                maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.BigNumber.from(tx.maxPriorityFeePerGas) : null,
                maxFeePerGas: tx.maxFeePerGas ? ethers.BigNumber.from(tx.maxFeePerGas) : null,
                gasLimit: tx.gasLimit ? parseInt(tx.gasLimit, 16) : null,
            });
        }
    });

    console.log('Started monitoring confirmed transaction');
    return prov.destroy;
}

module.exports = {
    streamPendingTxs,
    streamBlocks,
    streamFullBlocks,
    streamConfirmedTxs
};