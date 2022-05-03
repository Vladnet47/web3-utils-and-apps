const ethers = require('ethers');
const file = require('./file');

async function getAlchemyWsProv(chainId) {
    return await getWsProv((await file.readDefaultConfigs()).endpoints.alchemy, chainId);
}

async function getAlchemyHttpProv(chainId) {
    return await getHttpProv((await file.readDefaultConfigs()).endpoints.alchemy, chainId);
}

async function getAlchemyHttpsProv(chainId) {
    return await getHttpsProv((await file.readDefaultConfigs()).endpoints.alchemy, chainId);
}

async function getZmokWsProv(chainId) {
    return await getWsProv((await file.readDefaultConfigs()).endpoints.zmok, chainId);
}

async function getZmokHttpProv(chainId) {
    return await getHttpProv((await file.readDefaultConfigs()).endpoints.zmok, chainId);
}

async function getZmokHttpsProv(chainId) {
    return await getHttpsProv((await file.readDefaultConfigs()).endpoints.zmok, chainId);
}

async function getNftyWsProv(chainId) {
    return await getWsProv((await file.readDefaultConfigs()).endpoints.nftyWs, chainId);
}

async function getNftyHttpProv(chainId) {
    return await getHttpProv((await file.readDefaultConfigs()).endpoints.nftyHttp, chainId);
}

async function getNftyHttpsProv(chainId) {
    return await getHttpsProv((await file.readDefaultConfigs()).endpoints.nftyHttp, chainId);
}

async function getWsProv(endpoint, chainId) {
    if (!endpoint) {
        throw new Error('Missing endpoint');
    }
    const provider = new ethers.providers.WebSocketProvider('ws://' + endpoint, chainId);
    await provider.ready;
    return provider;
}

async function getHttpProv(endpoint, chainId) {
    if (!endpoint) {
        throw new Error('Missing endpoint');
    }
    const provider = new ethers.providers.JsonRpcProvider('http://' + endpoint, chainId);
    await provider.ready;
    return provider;
}

async function getHttpsProv(endpoint, chainId) {
    if (!endpoint) {
        throw new Error('Missing endpoint');
    }
    const provider = new ethers.providers.JsonRpcProvider('https://' + endpoint, chainId);
    await provider.ready;
    return provider;
}

// Creates new eip1559 transaction
// All values are in pre-processed state (fees in gwei, )
function createTx(to, max, prio, limit, value, data, nonce) {
    if (!to) {
        throw new Error('Missing to address');
    }
    if (!max) {
        throw new Error('Missing or invalid max fee');
    }
    if (!limit || limit < 21000) {
        throw new Error('Missing or invalid gas limit');
    }
    if (!nonce || nonce < 0) {
        throw new Error('Missing or invalid nonce');
    }
    max = ethers.utils.parseUnits(max.toString(), 'gwei');
    value = value ? ethers.utils.parseEther(value.toString()) : ethers.BigNumber.from(0);
    return {
        to,
        maxFeePerGas: max,
        maxPriorityFeePerGas: prio ? ethers.utils.parseUnits(prio, 'gwei') : max,
        gasLimit: limit,
        value,
        type: 2,
        data: data  || '0x',
        chainId: 1,
        nonce,
    };
}

// Formats and prints transaction
function printTx(tx = {}) {
    if (!tx) {
        throw new Error('Missing tx');
    }
    console.log(JSON.stringify({
        ...tx,
        maxFeePerGas: ethers.utils.formatUnits(tx.maxFeePerGas, 'gwei'),
        maxPriorityFeePerGas: ethers.utils.formatUnits(tx.maxPriorityFeePerGas, 'gwei'),
        value: ethers.utils.formatEther(tx.value),
    }, null, 2));
}

// Encodes transaction
function encodeTx(tx = {}) {
    if (!tx || tx.type == null) {
        throw new Error('Missing tx');
    }

    let serialized;
    if (tx.type === 2) {
        serialized = ethers.utils.serializeTransaction({
            to: tx.to,
            data: tx.data,
            gasPrice: tx.gasPrice,
            gasLimit: tx.gasLimit,
            chainId: tx.chainId,
            nonce: tx.nonce,
            value: tx.value
        }, {
            r: tx.r,
            s: tx.s,
            v: tx.v
        });
    }
    else {
        serialized = ethers.utils.serializeTransaction({
            to: tx.to,
            data: tx.data,
            maxFeePerGas: tx.maxFeePerGas,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
            gasLimit: tx.gasLimit,
            accessList: tx.accessList || [],
            type: 2,
            chainId: tx.chainId,
            nonce: tx.nonce,
            value: tx.value
        }, {
            r: tx.r,
            s: tx.s,
            v: tx.v
        });
    }

    const hash = ethers.utils.keccak256(serialized);
    if (tx.hash && hash !== tx.hash) {
        throw new Error('Serialization failed for tx ' + tx.hash + ': ' + serialized);
    }

    return serialized.toString();
}

// Encodes transaction data
function encodeTxData(fnSig, params) {
    if (!fnSig || !fnSig.includes('(') || !fnSig.includes(')') || !fnSig.endsWith(')')) {
        throw new Error('Missing or invalid function signature');
    }
    const abi = [(fnSig.startsWith('function') ? '' : 'function ') + fnSig];
    const iface = new ethers.utils.Interface(abi);
    try {
        return iface.encodeFunctionData(fn, params);
    }
    catch (err) {
        throw new Error('Invalid parameters for function signature: ' + err.message);
    }
}

// Returns address balance and nonce
function getWalletDetails(provider, address) {
    if (!provider) {
        throw new Error('Missing provider');
    }
    if (!address) {
        throw new Error('Missing address');
    }
    const [bal, nonce] = await Promise.all([
        provider.getBalance(address),
        provider.getTransactionCount(address),
    ]);
    return {
        balance: bal,
        nonce
    };
}

// Starts monitoring pending txs from provided address.
// Whenever encountered, calls callback.
// Uses alchemy ws provider.
async function monitorPendingTxs(address, callback, chainId) {
    return provider.destroy;
}

// Starts monitoring new block numbers.
// Whenever encountered, calls callback.
// Uses zmok http provider.
async function monitorBlocks(callback, chainId) {
    const prov = await getZmokHttpProv(chainId);
    prov.on('block', bn => {
        if (bn) {
            callback(bn);
        }
    });
    return prov.destroy;
}

// Starts monitoring new full blocks.
// Whenever encountered, calls callback.
// Uses alchemy http provider.
async function monitorFullBlocks(callback, chainId) {
    const prov = await getAlchemyHttpProv(chainId);
    prov.on('block', async bn => {
        if (bn) {
            callback(await prov.getBlock(bn));
        }
    });
    return prov.destroy;
}

// Starts monitoring confirmed txs.
// Whenever encountered, calls callback.
// Uses alchemy http provider.
async function monitorConfirmedTxs(address, callback, chainId) {
    return provider.destroy;
}

module.exports = {
    getAlchemyWsProv,
    getAlchemyHttpProv,
    getAlchemyHttpsProv,
    getZmokWsProv,
    getZmokHttpProv,
    getZmokHttpsProv,
    getNftyWsProv,
    getNftyHttpProv,
    getNftyHttpsProv,
    getWsProv,
    getHttpProv,
    getHttpsProv,
    createTx,
    printTx,
    encodeTx,
    encodeTxData,
    getWalletDetails,
    monitorPendingTxs,
    monitorConfirmedTxs,
    monitorBlocks,
    monitorFullBlocks
};