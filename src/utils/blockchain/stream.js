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
    address = address.toLowerCase();
    const endpoint = (await file.readConfigs()).endpoints.alchemy;
    const webs = new ws.WebSocket('wss://' + endpoint);

    webs.on('open', () => webs.send(JSON.stringify(
        { jsonrpc: '2.0', id: 1, method: 'eth_subscribe', params: ['alchemy_filteredNewFullPendingTransactions', { address }] }
    )));

    webs.on('message', async txStr => {
        if (txStr) {
            const json = JSON.parse(txStr.toString());
            if (json && json.params && json.params.result) {
                const tx = json.params.result;
                await callback({
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    data: tx.input != null ? tx.input : tx.data,
                    value: tx.value ? ethers.BigNumber.from(tx.value) : null,
                    gasPrice: tx.gasPrice ? ethers.BigNumber.from(tx.gasPrice) : null,
                    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.BigNumber.from(tx.maxPriorityFeePerGas) : null,
                    maxFeePerGas: tx.maxFeePerGas ? ethers.BigNumber.from(tx.maxFeePerGas) : null,
                    gasLimit: tx.gas ? parseInt(tx.gas, 16) : null,
                    type: parseInt(tx.type, 16),
                    nonce: tx.nonce,
                    chainId: parseInt(tx.chainId, 16),
                    nonce: parseInt(tx.nonce, 16),
                    v: parseInt(tx.v, 16),
                    r: tx.r,
                    s: tx.s,
                    accessList: tx.accessList,
                });
            }
        }
    });

    console.log('Started streaming pending txs for ' + address);
    return async () => {
        webs.close();
        console.log('Closed pending tx stream');
    };
}

// Starts monitoring new block numbers.
// Whenever encountered, calls callback.
// Uses zmok http provider.
async function streamBlocks(callback, chainId) {
    if (!callback) {
        throw new Error('Missing callback');
    }

    let blockNumber = 0;
    const prov = await common.getZmokHttpProv(chainId);
    prov.on('block', async bn => {
        if (bn && bn > blockNumber) {
            blockNumber = bn;
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
    return async () => {
        await prov.destroy();
        console.log('Closed block number stream');
    };
}

// Starts monitoring new full blocks.
// Whenever encountered, calls callback.
// Uses alchemy http provider.
async function streamFullBlocks(callback, chainId) {
    if (!callback) {
        throw new Error('Missing callback');
    }

    let blockNumber = 0;
    const prov = await common.getAlchemyHttpProv(chainId);
    prov.on('block', async bn => {
        if (bn && bn > blockNumber) {
            blockNumber = bn;
            let block;
            try {
                block = await prov.getBlockWithTransactions(bn);
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
    return async () => {
        await prov.destroy();
        console.log('Closed full block stream');
    };
}

// Starts monitoring confirmed hashes.
// Whenever encountered, calls callback.
// Uses alchemy http provider.
async function streamConfirmedHashes(address, callback, chainId) {
    if (!callback) {
        throw new Error('Missing callback');
    }
    if (!address) {
        throw new Error('Missing address');
    }
    address = address.toLowerCase();
    const prov = await common.getAlchemyHttpProv(chainId);

    prov.on({ address }, async tx => {
        if (tx && tx.transactionHash) {
            await callback(tx.transactionHash);
        }
    });

    console.log('Started monitoring confirmed tx hashes for ' + address);
    return async () => {
        await prov.destroy();
        console.log('Closed confirmed tx hash stream');
    };
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
    address = address.toLowerCase();

    const cb = async block => {
        const tasks = [];
        for (const tx of block.transactions) {
            if (tx.to && tx.to.toLowerCase() === address) {
                tx.gasLimit = tx.gasLimit.toString();
                tasks.push(callback(tx));
            }
        }
        await Promise.all(tasks);
    }

    const close = await streamFullBlocks(cb, chainId);

    console.log('Started monitoring confirmed txs for ' + address);
    return async () => {
        await close();
        console.log('Closed confirmed tx stream');
    };
}

module.exports = {
    streamPendingTxs,
    streamBlocks,
    streamFullBlocks,
    streamConfirmedHashes,
    streamConfirmedTxs,
};