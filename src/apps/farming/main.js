const { readConfigs, streamPendingTxs, printTx, LooksRequests, getNftyHttpsProv, streamBlocks } = require('../../utils');
const CancelManager = require('./cancel-manager');
const FarmingController = require('./controller');
const DiscordController = require('./discord');
const PolicyManager = require('./policy-manager');
const SignerManager = require('./signer-manager');

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a';
const GEM_ADDRESS = '0x83C8F28c26bF6aaca652Df1DbBE0e1b56F8baBa2';

const WS_RESTART_DELAY = 3600000; // Once an hour

async function main() {
    const { debug, channelName, discordKey, auth, saveDir } = await readConfigs();
    const prov = await getNftyHttpsProv();
    const signerManager = new SignerManager(prov);
    const policyManager = new PolicyManager(saveDir + (saveDir.endsWith('/') ? '' : '/') + 'policies.csv');
    const cancelManager = new CancelManager(signerManager);
    const looksRequests = new LooksRequests(true);
    const farmingController = new FarmingController(prov, signerManager, policyManager, cancelManager, looksRequests, debug);

    await Promise.all([
        signerManager.load(),
        policyManager.load(),
        looksRequests.load(),
        farmingController.syncBaseFee(),
    ]);
    
    const discordCont = new DiscordController(channelName, discordKey, auth, farmingController, signerManager, policyManager);
    await discordCont.start();

    console.log('Starting farming controller in ' + (debug === false ? 'PROD' : 'DEBUG') + ' mode');
    await run(farmingController, signerManager);
}

async function run(farmingController, signerManager) {
    console.log('(re)starting websocket connections!');

    const frontrunSaleTx = async tx => {
        try {
            await farmingController.frontrunSaleTx(tx);
        }
        catch (err) {
            console.log('Failed to handle tx ' + tx.hash + ': ' + err.message);
            console.log(err.stack);
            console.log(printTx(tx));
        }
    };

    const updateBlock = async block => {
        console.log('Encountered block ' + block.number);
        await Promise.all([
            farmingController.syncBaseFee(block.baseFeePerGas),
            signerManager.sync(),
        ]);
    };

    const [closeLooks, closeGems, closeBlocks] = await Promise.all([
        streamPendingTxs(LOOKS_ADDRESS, frontrunSaleTx),
        streamPendingTxs(GEM_ADDRESS, frontrunSaleTx),
        streamBlocks(updateBlock)
    ]);

    // Restart after an hour to prevent socket from timing out
    setTimeout(async () => {
        await Promise.all([
            closeLooks(),
            closeGems(),
            closeBlocks(),
        ]);
        await run(farmingController, signerManager);
    }, WS_RESTART_DELAY);
}

module.exports = main;