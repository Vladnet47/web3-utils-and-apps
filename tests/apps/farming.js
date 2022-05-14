const ethers = require('ethers');
const FarmingController = require('../../src/apps/farming/controller');
const SignerManager = require('../../src/apps/farming/signer-manager');
const PolicyManager = require('../../src/apps/farming/policy-manager');
const { getNftyHttpsProv, getAlchemyHttpProv, getContractAbiSigs, readConfigs, LooksRequests, getContractAbi } = require('../../src/utils');

//const TX_HASH = '0xae10552105783ae94523d87b4a1c947c13e254b7903892237fed2a282ab4071b'; // batchBuyWithETH
//const TX_HASH = '0x2e4e2d8991cb62e88d0bae051e39bd65763d9f7e95005615bf0deec23eeb0510'; // batchBuyWithERC20s
const TX_HASH = '0x30a55b28692d6f9e0b8c07f8505ca4f48784b2c506f7ef9030936336507f49a0'; // matchAskWithTakerBidUsingETHAndWETH
//const TX_HASH = '0xee09c09d5405e322352ee2ec0e782623c6ed73bbfc91f2b5c0d85dd27970422c'; // matchAskWithTakerBid
//const TX_HASH = '0x03ed4204645dbda51d0d8c5cc478bae11601303fc748864455b5c75006eeb47b'; // matchBidWithTakerAsk
process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';
const SAVE_PATH = process.cwd() + '/tests/apps/policies.csv';

async function main() {
    const prov = await getNftyHttpsProv();
    const signerManager = new SignerManager(prov);
    const policyManager = new PolicyManager(SAVE_PATH);
    const looksRequests = new LooksRequests(false);
    const le = new FarmingController(signerManager, policyManager, looksRequests, true);
    
    await Promise.all([
        signerManager.load(),
        policyManager.load(),
        looksRequests.load(),
    ]);

    //policyManager.add(signerManager.getAddress('vdog'), '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', 81312, ethers.utils.parseEther('0.1'));
    //await policyManager.save();
    const tx = await prov.getTransaction(TX_HASH);
    await le.frontrunSaleTx(tx);
}

main().catch(console.log);