const { readConfigs, streamPendingTxs, printTx } = require('../../utils');
const LooksEnsurer = require('./looks-insurer');

const TOKEN_CONFIGS = [
    {
        owner: '0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C2d',
        tokenContract: '',
        tokenId: 81312,
        listingNonce: 12,
        maxInsurance: 0.1,
    },
];

const DEBUG = true;

async function main() {
    const { privateKeys } = await readConfigs();
    const looksEnsurer = new LooksEnsurer(privateKeys, DEBUG);
    for (const c of TOKEN_CONFIGS) {
        looksEnsurer.addToken(c.owner, c.tokenContract, c.tokenId, c.listingNonce, c.maxInsurance);
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