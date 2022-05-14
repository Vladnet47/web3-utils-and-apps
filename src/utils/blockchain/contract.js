const ethers = require('ethers');
const got = require('got');
const file = require('../file');

async function getContractAbi(address) {
    const { etherscan } = await file.readConfigs();
    if (!etherscan) {
        throw new Error('Missing etherscan key');
    }
    if (!ethers.utils.isAddress(address)) {
        throw new Error('Missing address');
    }
    const response = await got.get('https://api.etherscan.io/api?module=contract&action=getabi&address=' + address + '&apikey=' + etherscan, { 
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

async function getContractSourceCode(address) {
    const { etherscan } = await file.readConfigs();
    if (!etherscan) {
        throw new Error('Missing etherscan key');
    }
    if (!ethers.utils.isAddress(address)) {
        throw new Error('Missing address');
    }

    const response = await got.get('https://api.etherscan.io/api?module=contract&action=getsourcecode&address=' + address + '&apikey=' + etherscan, { 
        responseType: 'json', 
        timeout: 6000, 
        retry: 0 
    });
    const body = response.body;
    if (body.status !== '1') {
        throw new Error('Failed to retrieve contract source code: ' + body.message);
    }
    const details = body.result;
    if (!Array.isArray(details) || details.length === 0) {
        throw new Error('Contract is not verified');
    }
    const first = details[0].SourceCode;
    const code = JSON.parse(first.substring(1, first.length - 1));
    if (!code) {
        throw new Error('Missing source code');
    }
    const contracts = [];
    for (const [name, value] of Object.entries(code.sources)) {
        const split = name.split('/');
        contracts.push({ name: split[split.length - 1], code: value.content });
    }
    return contracts;
}

async function getContractAbiSigs(address, sigsToMatch = []) {
    if (!Array.isArray(sigsToMatch) || sigsToMatch.length === 0) {
        throw new Error('Missing sigs to match');
    }
    const abi = await getContractAbi(address);
    const iface = new ethers.utils.Interface(abi);
    const matches = {};
    for (const sig of sigsToMatch) {
        matches[sig] = iface.getFunction(sig).format(ethers.utils.FormatTypes.full);
    }
    return matches;
}

module.exports = {
    getContractAbi,
    getContractSourceCode,
    getContractAbiSigs,
};