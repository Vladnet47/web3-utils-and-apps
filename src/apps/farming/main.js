const { readConfigs, streamPendingTxs, printTx, LooksRequests, getNftyHttpsProv } = require('../../utils');
const FarmingController = require('./controller');
const DiscordController = require('./discord');
const PolicyManager = require('./policy-manager');
const SignerManager = require('./signer-manager');

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a';
const GEM_ADDRESS = '0x83C8F28c26bF6aaca652Df1DbBE0e1b56F8baBa2';

const WS_RESTART_DELAY = 3600000; // Once an hour
const SAVE_PATH = process.cwd() + '/policies.csv';

async function main() {
    const { debug, discordKey, auth } = await readConfigs();
    const prov = await getNftyHttpsProv();
    const signerManager = new SignerManager(prov);
    const policyManager = new PolicyManager(SAVE_PATH);
    const looksRequests = new LooksRequests(true);
    const looksEnsurer = new FarmingController(signerManager, policyManager, looksRequests, debug);

    await Promise.all([
        signerManager.load(),
        policyManager.load(),
        looksRequests.load(),
    ]);
    
    const discordCont = new DiscordController(discordKey, auth, looksEnsurer);
    await discordCont.start();

    console.log('Starting farming controller in ' + (debug === false ? 'PROD' : 'DEBUG') + ' mode');
    await run(looksEnsurer);
}

async function run(looksEnsurer) {
    console.log('(re)starting websocket connections!');

    const frontrunSaleTx = async tx => {
        try {
            await looksEnsurer.frontrunSaleTx(tx);
        }
        catch (err) {
            console.log('Failed to handle tx ' + tx.hash + ': ' + err.message);
            console.log(err.stack);
            console.log(printTx(tx));
        }
    };

    const [closeLooks, closeGems] = await Promise.all([
        streamPendingTxs(LOOKS_ADDRESS, frontrunSaleTx),
        streamPendingTxs(GEM_ADDRESS, frontrunSaleTx)
    ]);

    // Restart after an hour to prevent socket from timing out
    setTimeout(async () => {
        await Promise.all([
            closeLooks(),
            closeGems(),
        ]);
        await run(looksEnsurer);
    }, WS_RESTART_DELAY);
}

module.exports = main;