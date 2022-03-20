const ethers = require('ethers');
const utils = require('./utils');
const scan = require('./scan');
const { 
    identifyWriteOffs,
    sortByTimestamp,
    calcGasFees
} = require('./process');
const { 
    toJsonSummary 
} = require('./format');

async function main() {
    // Read user configs from file
    const jsonPath = process.cwd() + '/configs.json';
    let configs;
    try {
        configs = await utils.readJson(jsonPath);
    }
    catch (err) {
        throw new Error('Failed to read configs at \'' + jsonPath + '\': ' + err.message);
    }

    // Validate user configs
    const { etherscanKey, wallets, wsEndpoint } = configs;
    if (!etherscanKey) {
        throw new Error('Please update etherscanKey');
    }
    if (wallets.length === 0) {
        throw new Error('Please add at least one valid ethereum address to WALLETS');
    }
    if (!wsEndpoint) {
        throw new Error('Missing websocket endpoint');
    }
    for (const wallet of wallets) {
        if (!ethers.utils.isAddress(wallet)) {
            throw new Error('Wallet ' + address + ' is not valid format');
        }
    }

    const provider = new ethers.providers.WebSocketProvider(wsEndpoint.startsWith('wss://') ? wsEndpoint : 'wss://' + wsEndpoint);
    try {
        let txs = await scan(etherscanKey, wallets);
        txs = identifyWriteOffs(txs);
        txs = calcGasFees(txs);
        txs = sortByTimestamp(txs);
        console.log(JSON.stringify(toJsonSummary(txs), null, 4));
    }
    finally {
        await provider.destroy();
    }
}

main().catch(console.log);