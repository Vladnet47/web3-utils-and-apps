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
    getAddressDetails
};