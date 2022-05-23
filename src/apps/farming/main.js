const { readConfigs, streamPendingTxs, printTx, LooksRequests, getNftyHttpsProv, streamBlocks } = require('../../utils');
const FarmingController = require('./controller');
const DiscordController = require('./discord');
const { SignerManager, CancelPolicyManager, ListingPolicyManager } = require('./managers');

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a';
const GEM_ADDRESS = '0x83C8F28c26bF6aaca652Df1DbBE0e1b56F8baBa2';

const WS_RESTART_DELAY = 3600000; // Once an hour

async function main() {
    const { debug, channelName, discordKey, auth, saveDir } = await readConfigs();
    const prov = await getNftyHttpsProv();
    const signerManager = new SignerManager(prov);
    const looksRequests = new LooksRequests(true);
    const cancelManager = new CancelPolicyManager(signerManager, saveDir + (saveDir.endsWith('/') ? '' : '/') + 'cancel-policies.csv');
    const listingManager = new ListingPolicyManager(signerManager, saveDir + (saveDir.endsWith('/') ? '' : '/') + 'listing-policies.csv', looksRequests);
    const farmingController = new FarmingController(prov, signerManager, cancelManager, listingManager, debug);

    await looksRequests.load();
    await Promise.all([
        signerManager.load(),
        cancelManager.load(),
        listingManager.load(),
        farmingController.syncBaseFee(),
    ]);
    
    const discordCont = new DiscordController(channelName, discordKey, auth, farmingController, signerManager, cancelManager, listingManager);
    await discordCont.start();

    console.log('Starting farming controller in ' + (debug === false ? 'PROD' : 'DEBUG') + ' mode');
    await run(farmingController, signerManager);

    setInterval(() => listingManager.syncAllListings(), 10000);
    setInterval(() => listingManager.syncAllFloorPrices(), 180000);
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