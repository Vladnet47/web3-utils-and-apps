const { readConfigs, streamPendingTxs, printTx } = require('../../utils');
const LooksEnsurer = require('./looks-insurer');

const TOKEN_CONFIGS = [
    {
        owner: '0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C2d',
        tokenContract: '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258',
        tokenId: 81312,
        listingNonce: 12,
        maxInsurance: 0.1,
    },
    {
        owner: '0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C2d',
        tokenContract: '0xfb7d186e24e128be1f1339fb9c2ba6fdbd87c6f9',
        tokenId: 14583,
        listingNonce: 17,
        maxInsurance: 0.1,
    },
];

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';
const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a';
const DEBUG = false;

async function main() {
    const { privateKeys } = await readConfigs();
    const looksEnsurer = new LooksEnsurer(privateKeys, DEBUG);
    await looksEnsurer.load();
    for (const c of TOKEN_CONFIGS) {
        await looksEnsurer.addToken(c.owner, c.tokenContract, c.tokenId, c.listingNonce, c.maxInsurance);
    }

    await streamPendingTxs(LOOKS_ADDRESS, async tx => {
        try {
            await looksEnsurer.handleTx(tx);
        }
        catch (err) {
            console.log('Failed to handle tx ' + tx.hash + ': ' + err.message);
            console.log(err.stack);
            console.log(printTx(tx));
        }
    });
}

module.exports = main;