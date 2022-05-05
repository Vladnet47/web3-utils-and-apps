const ethers = require('ethers');
const file = require('../file');

async function getAlchemyWsProv(chainId) {
    return await getWsProv((await file.readConfigs()).endpoints.alchemy, chainId);
}

async function getAlchemyHttpProv(chainId) {
    return await getHttpProv((await file.readConfigs()).endpoints.alchemy, chainId);
}

async function getAlchemyHttpsProv(chainId) {
    return await getHttpsProv((await file.readConfigs()).endpoints.alchemy, chainId);
}

async function getZmokWsProv(chainId) {
    return await getWsProv((await file.readConfigs()).endpoints.zmok, chainId);
}

async function getZmokHttpProv(chainId) {
    return await getHttpProv((await file.readConfigs()).endpoints.zmok, chainId);
}

async function getZmokHttpsProv(chainId) {
    return await getHttpsProv((await file.readConfigs()).endpoints.zmok, chainId);
}

async function getNftyWsProv(chainId) {
    return await getWsProv((await file.readConfigs()).endpoints.nftyWs, chainId);
}

async function getNftyHttpProv(chainId) {
    return await getHttpProv((await file.readConfigs()).endpoints.nftyHttp, chainId);
}

async function getNftyHttpsProv(chainId) {
    return await getHttpsProv((await file.readConfigs()).endpoints.nftyHttp, chainId);
}

async function getEtherscanProv(chainId) {
    const etherscan = (await file.readConfigs()).etherscan;
    if (!etherscan) {
        throw new Error('Missing etherscan key');
    }
    const prov = new ethers.providers.EtherscanProvider(chainId, etherscan);
    await prov.ready;
    return prov;
}

async function getWsProv(endpoint, chainId) {
    if (!endpoint) {
        throw new Error('Missing endpoint');
    }
    const provider = new ethers.providers.WebSocketProvider('ws://' + endpoint, chainId);
    await provider.ready;
    console.log('Connected to ws provider');
    return provider;
}

async function getHttpProv(endpoint, chainId) {
    if (!endpoint) {
        throw new Error('Missing endpoint');
    }
    const provider = new ethers.providers.JsonRpcProvider('http://' + endpoint, chainId);
    await provider.ready;
    console.log('Connected to http provider');
    return provider;
}

async function getHttpsProv(endpoint, chainId) {
    if (!endpoint) {
        throw new Error('Missing endpoint');
    }
    const provider = new ethers.providers.JsonRpcProvider('https://' + endpoint, chainId);
    await provider.ready;
    console.log('Connected to https provider');
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
        gasPrice: tx.gasPrice ? ethers.utils.formatUnits(tx.gasPrice, 'gwei') : null,
        maxFeePerGas: tx.maxFeePerGas ? ethers.utils.formatUnits(tx.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.utils.formatUnits(tx.maxPriorityFeePerGas, 'gwei') : null,
        value: tx.value ? ethers.utils.formatEther(tx.value) : '0',
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
async function getAddressDetails(provider, address) {
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
    getEtherscanProv,
    getWsProv,
    getHttpProv,
    getHttpsProv,
    createTx,
    printTx,
    encodeTx,
    encodeTxData,
    getAddressDetails,
};