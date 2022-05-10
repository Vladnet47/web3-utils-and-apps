const { readConfigs, streamPendingTxs, printTx } = require('../../utils');
const LooksEnsurer = require('./looks-insurer');

const TOKEN_CONFIGS = [
    {
        owner: 'vdog1',
        tokenContract: '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258',
        tokenId: 81312,
        maxInsurance: 0.1,
    },
];

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a';
const WS_RESTART_DELAY = 3600000; // Once an hour

async function main() {
    const { privateKeys, debug } = await readConfigs();
    const looksEnsurer = new LooksEnsurer(privateKeys, debug);
    await looksEnsurer.load();
    for (const c of TOKEN_CONFIGS) {
        looksEnsurer.addPolicy(c.owner, c.tokenContract, c.tokenId, c.maxInsurance);
    }

    console.log('Starting looks insurance in ' + (debug === false ? 'prod' : 'debug') + ' mode');
    await start(looksEnsurer);
}

async function start(looksEnsurer) {
    console.log('(re)starting websocket connection!');
    const close = await streamPendingTxs(LOOKS_ADDRESS, async tx => {
        try {
            await looksEnsurer.handleTx(tx);
        }
        catch (err) {
            console.log('Failed to handle tx ' + tx.hash + ': ' + err.message);
            console.log(err.stack);
            console.log(printTx(tx));
        }
    });

    // Restart after an hour to prevent socket from timing out
    setTimeout(async () => {
        await close();
        await start(looksEnsurer);
    }, WS_RESTART_DELAY);
}

module.exports = main;