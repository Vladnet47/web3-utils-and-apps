const ethers = require('ethers');
const FarmingController = require('../../../src/apps/farming/controller');
const SignerManager = require('../../../src/apps/farming/signer-manager');
const PolicyManager = require('../../../src/apps/farming/policy-manager');
const CancelManager = require('../../../src/apps/farming/cancel-manager');
const { getNftyHttpsProv, LooksRequests } = require('../../../src/utils');
const { Token, Listing } = require('../../../src/apps/farming/objects');
const { createLooksrareBuyTx } = require('./utils');

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
    const policyManager = new PolicyManager(SAVE_PATH);
    const cancelManager = new CancelManager(signerManager, prov);
    const looksRequests = new LooksRequests(false);    
    await Promise.all([
        signerManager.load(),
        policyManager.load(),
        looksRequests.load(),
    ]);

    const farmingCont = new FarmingController(prov, signerManager, policyManager, cancelManager, looksRequests, true);
    await farmingCont.syncBaseFee();

    const tests = [
        //testNotTokenMatch,
        //testBalTooLow,
        //testInsTooLow,
        //testMatchAskWithTakerBidUsingETHAndWETH,
        //testBatchBuyWithETH,
    ];

    for (const test of tests) {
        await test(prov, farmingCont, signerManager, policyManager);
    }
}

async function testBalTooLow(prov, farmingCont, sm, pm) {
    if (!prov || !farmingCont || !sm || !pm) {
        throw new Error('Missing required parameters');
    }
    const token = new Token('0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', 45108);
    pm.clear();
    pm.add(sm.getAddress('test'), token, ethers.utils.parseEther('0.1'));
    const tx = createLooksrareBuyTx(new Listing(token, 17), 200, 1);
    await farmingCont.frontrunSaleTx(tx);
}

async function testInsTooLow(prov, farmingCont, sm, pm) {
    if (!prov || !farmingCont || !sm || !pm) {
        throw new Error('Missing required parameters');
    }
    const token = new Token('0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', 45108);
    pm.clear();
    pm.add(sm.getAddress('vdog'), token, ethers.utils.parseEther('0.00001'));
    const tx = createLooksrareBuyTx(new Listing(token, 17), 200, 1);
    await farmingCont.frontrunSaleTx(tx);
}

async function testNotTokenMatch(prov, farmingCont, sm, pm) {
    if (!prov || !farmingCont || !sm || !pm) {
        throw new Error('Missing required parameters');
    }
    const token = new Token('0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', 45108);
    pm.clear();
    pm.add(sm.getAddress('test'), token, ethers.utils.parseEther('0.1'));
    const tx = createLooksrareBuyTx(new Listing(new Token('0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', 45110), 17), 200, 1);
    await farmingCont.frontrunSaleTx(tx);
}

async function testMatchAskWithTakerBidUsingETHAndWETH(prov, farmingCont, sm, pm) {
    if (!prov || !farmingCont || !sm || !pm) {
        throw new Error('Missing required parameters');
    }
    const token = new Token('0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', 45108);
    pm.clear();
    pm.add(sm.getAddress('vdog'), token, ethers.utils.parseEther('0.1'));
    const tx = createLooksrareBuyTx(new Listing(token, 17), 200, 1);
    await farmingCont.frontrunSaleTx(tx);
}

async function testBatchBuyWithETHGroupInsTooLow(prov, farmingCont, sm, pm) {
    if (!prov || !farmingCont || !sm || !pm) {
        throw new Error('Missing required parameters');
    }
    pm.clear();
    const kai = sm.getAddress('kai');
    pm.add(kai, new Token('0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', 45108), ethers.utils.parseEther('0.1'));

    const hash = '0xae10552105783ae94523d87b4a1c947c13e254b7903892237fed2a282ab4071b';
    const tx = await prov.getTransaction(hash);
    await farmingCont.frontrunSaleTx(tx);
}

async function testBatchBuyWithETH(prov, farmingCont, sm, pm) {

}

main().catch(console.log);