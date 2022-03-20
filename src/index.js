const ethers = require('ethers');
const scanTxs = require('./scan-tx');
const calcWriteOffs = require('./calc-writeoffs');
const utils = require('./utils');

async function main() {
    // Read user configs from file
    const jsonPath = process.cwd() + '/configs.json';
    let json;
    try {
        json = await utils.readJson(jsonPath);
    }
    catch (err) {
        console.log('Failed to find configs at ' + jsonPath + ' with error: ' + err.message);
        return;
    }

    // Validate user configs
    const { etherscanKey, wallets, wsEndpoint } = json;
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
    const txs = await scanTxs(etherscanKey, wallets);
    const totalTxCount = txs.length;
    const { excludedTxs, gasCost } = await calcWriteOffs(provider, txs);
    const excludedTxCount = excludedTxs.length;
    console.log('Wrote off ' + (totalTxCount - excludedTxCount) + '/' + totalTxCount + ' txs: ' + ethers.utils.formatEther(gasCost)) + 'Ξ';
    await provider.destroy();
}

main().catch(console.log);

/*

"0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C2d",
        "0x6CE34081D4EFC4b7E10B776f618B5e6ad96370F0",
        "0xC73790870F422350096EF0c19b06DF1C0060d3ca"
        */