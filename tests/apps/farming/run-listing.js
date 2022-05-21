const ethers = require('ethers');
const { SignerManager, ListingPolicyManager } = require('../../../src/apps/farming/managers');
const { getNftyHttpsProv, LooksRequests, sleep } = require('../../../src/utils');
const { Token, Purchase, ListingPolicy } = require('../../../src/apps/farming/objects');
const { createLooksrareBuyTx, createGemBuyTx } = require('./utils');

//0xae10552105783ae94523d87b4a1c947c13e254b7903892237fed2a282ab4071b -> batchBuyWithETH
//0x2e4e2d8991cb62e88d0bae051e39bd65763d9f7e95005615bf0deec23eeb0510 -> batchBuyWithERC20s
//0x30a55b28692d6f9e0b8c07f8505ca4f48784b2c506f7ef9030936336507f49a0 -> matchAskWithTakerBidUsingETHAndWETH
//0xee09c09d5405e322352ee2ec0e782623c6ed73bbfc91f2b5c0d85dd27970422c -> matchAskWithTakerBid
//0x03ed4204645dbda51d0d8c5cc478bae11601303fc748864455b5c75006eeb47b -> matchBidWithTakerAsk

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';
const SAVE_PATH = process.cwd() + '/tests/apps/policies.csv';

async function main() {
    const prov = await getNftyHttpsProv();
    const signerManager = new SignerManager(prov);
    const looksRequests = new LooksRequests(false);
    const listingManager = new ListingPolicyManager(signerManager, SAVE_PATH, looksRequests);

    await Promise.all([
        signerManager.load(),
        listingManager.load(),
        looksRequests.load(),
    ]);

    const token = new Token('0xfb7d186E24E128be1F1339fB9C2bA6fDBd87C6f9', 14583);
    await listingManager.addPolicy(new ListingPolicy(signerManager.getAddress('vdog'), token, 100, 60000));

    while (true) {
        await listingManager.syncAllListings();
        await sleep(10000);
        listingManager.removePolicy(token);
    }
}

main().catch(console.log);