const ethers = require('ethers');
const utils = require('./utils');
const scan = require('./scan');
const { 
    classify,
    sortByTimestamp,
    calcGasFees
} = require('./process');
const { 
    toJsonSummary 
} = require('./report');

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

    const { 
        etherscanKey, 
        wallets = [],
        flags = {},
    } = configs;

    // Validate user configs
    if (!etherscanKey) {
        throw new Error('Please update etherscanKey');
    }
    if (wallets.length === 0) {
        throw new Error('Please add at least one valid ethereum address to WALLETS');
    }
    for (let i = 0; i < wallets.length; ++i) {
        const wallet = wallets[i];
        if (!ethers.utils.isAddress(wallet)) {
            throw new Error('Wallet ' + address + ' is not valid format');
        }
        wallets[i] = wallet.toLowerCase();
    }

    // Scan and process txs from user wallets, then format output
    const txs = await scan(etherscanKey, wallets);
    classify(txs, wallets);
    calcGasFees(txs);
    sortByTimestamp(txs);
    console.log(JSON.stringify(toJsonSummary(txs, flags), null, 4));

    // const provider = new ethers.providers.WebSocketProvider(wsEndpoint.startsWith('wss://') ? wsEndpoint : 'wss://' + wsEndpoint);
    // try {
        
    // }
    // finally {
    //     await provider.destroy();
    // }
}

main().catch(console.log);