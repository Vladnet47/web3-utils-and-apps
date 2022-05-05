const ethers = require('ethers');
const got = require('got');
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
function createTx(to, max, prio, limit, value, data, nonce, type) {
    if (!ethers.utils.isAddress(to)) {
        throw new Error('Missing to address');
    }
    if (!max) {
        throw new Error('Missing or invalid max fee');
    }
    if (!limit || limit < 21000) {
        throw new Error('Missing or invalid gas limit');
    }
    if (nonce == null || nonce < 0) {
        throw new Error('Missing or invalid nonce');
    }
    if (type != null) {
        if (type !== 0 && type !== 2) {
            throw new Error('Type must be 0 or 2');
        }
    }
    else {
        type = 2;
    }
    max = ethers.utils.parseUnits(max.toString(), 'gwei');
    value = value ? ethers.utils.parseEther(value.toString()) : ethers.BigNumber.from(0);
    return {
        to,
        gasPrice: max,
        maxFeePerGas: max,
        maxPriorityFeePerGas: prio ? ethers.utils.parseUnits(prio.toString(), 'gwei') : max,
        gasLimit: limit,
        value,
        type: type == null ? 2 : type,
        data: data || '0x',
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
    if (!tx) {
        throw new Error('Missing tx');
    }
    if (tx.type == null) {
        throw new Error('Missing tx type');
    }

    let serialized;
    if (tx.type === 0) {
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
    if (!fnSig || !fnSig.includes('(') || !fnSig.includes(')')) {
        throw new Error('Missing or invalid function signature');
    }
    const abi = [(fnSig.startsWith('function') ? '' : 'function ') + fnSig];
    const iface = new ethers.utils.Interface(abi);
    try {
        return iface.encodeFunctionData(fnSig, params);
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

async function getContractAbi(etherscanKey, address) {
    if (!etherscanKey) {
        throw new Error('Missing etherscan key');
    }
    if (!ethers.utils.isAddress(address)) {
        throw new Error('Missing address');
    }
    const response = await got.get('https://api.etherscan.io/api?module=contract&action=getabi&address=' + address + '&apikey=' + etherscanKey, { 
        responseType: 'json', 
        timeout: 6000, 
        retry: 0 
    });
    const body = response.body;
    if (body.status !== '1') {
        throw new Error('Failed to retrieve contract abi: ' + body.message);
    }
    const abi = body.result;
    if (!abi || abi === 'Contract source code not verified') {
        throw new Error('Contract is not verified');
    }
    return JSON.parse(abi);
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
    getContractAbi,
};