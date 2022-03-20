const ethers = require('ethers');
const got = require('got');
const utils = require('./utils');

// Wallets to scan
const WALLETS = [
    //'0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85Ce9',
];

async function main() {
    // Read configs from json file
    const jsonPath = process.cwd() + '/configs.json';
    let json;
    try {
        json = await utils.readJson(jsonPath);
    }
    catch (err) {
        console.log('Failed to find configs at ' + jsonPath + ' with error: ' + err.message);
        return;
    }

    // Validate user inputs
    const { etherscanKey } = json;
    validateInputs(etherscanKey, WALLETS);

    const allTxs = [];

    // Scan each wallet individually to avoid etherscan rate limit
    for (const wallet of WALLETS) {
        // Scan regular txs
        try {
            const txs = await getRegularTxs(etherscanKey, wallet);
            for (const tx of txs) {
                allTxs.push({ ...tx, internal: false });
            }
            console.log('Successfully retrieved ' + txs.length + ' regular txs for ' + wallet);
        }
        catch (err) {
            console.log('Failed to retrieve regular txs for ' + wallet);
        }

        // Scan internal txs
        try {
            const txs = await getInternalTxs(etherscanKey, wallet);
            for (const tx of txs) {
                allTxs.push({ ...tx, internal: true });
            }
            console.log('Successfully retrieved ' + txs.length + ' internal txs for ' + wallet);
        }
        catch (err) {
            console.log('Failed to retrieve internal txs for ' + wallet);
        }
    }

    allTxs.sort((a, b) => {
        const aTs = parseInt(a.timeStamp);
        const bTs = parseInt(b.timeStamp);
        return aTs - bTs;
    });

    const outputPath = process.cwd() + '/out/scan-tx-' + Date.now() + '.json';
    await utils.writeJson(outputPath, allTxs);
}

function validateInputs(etherscanKey, wallets) {
    if (!etherscanKey) {
        throw new Error('Please update etherscanKey');
    }
    if (wallets.length === 0) {
        throw new Error('Please add at least one valid ethereum address to WALLETS');
    }
    for (const wallet of wallets) {
        if (!ethers.utils.isAddress(wallet)) {
            throw new Error('Wallet ' + address + ' is not valid format');
        }
    }
}

async function getRegularTxs(etherscanKey, address) {
    if (!etherscanKey || !address) {
        throw new Error('Missing etherscan key or wallet address');
    }
    const response = await got.get('https://api.etherscan.io/api?module=account&action=txlist&address=' + address + '&sort=asc&apikey=' + etherscanKey, { 
        responseType: 'json', 
        timeout: 10000, 
        retry: 0 
    });
    const body = response.body;
    if (body.status !== '1') {
        throw new Error('Failed to retrieve regular txs for ' + address + ':' + body.message);
    }
    const txList = body.result;
    return txList;
}

async function getInternalTxs(etherscanKey, address) {
    if (!etherscanKey || !address) {
        throw new Error('Missing etherscan key or wallet address');
    }
    const response = await got.get('https://api.etherscan.io/api?module=account&action=txlistinternal&address=' + address + '&sort=asc&apikey=' + etherscanKey, { 
        responseType: 'json', 
        timeout: 10000, 
        retry: 0 
    });
    const body = response.body;
    if (body.status !== '1') {
        throw new Error('Failed to retrieve regular txs for ' + address + ':' + body.message);
    }
    const txList = body.result;
    return txList;
}

main().catch(console.log);