const ethers = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');
const { readConfigs } = require('../file');
const { getNftyHttpsProv } = require('./common');
const { streamBlocks } = require('./stream');

async function getFbProvider(chainId) {
    const prov = await getNftyHttpsProv(chainId);
    const { privateKeys } = await readConfigs();
    if (!privateKeys || !privateKeys.vdog1) {
        throw new Error('Missing flashbots key');
    }
    const fbProv = await FlashbotsBundleProvider.create(prov, new ethers.Wallet(privateKeys.vdog1));
    console.log('Connected to flashbots provider');
    return fbProv;
}

async function sendBundle(signer, bundle, targetBlock) {
    if (!signer || !(signer instanceof FlashbotsBundleProvider)) {
        throw new Error('Missing or invalid flashbots signer');
    }
    if (!bundle) {
        throw new Error('Missing flashbots bundle');
    }
    if (!targetBlock) {
        targetBlock = (await signer.genericProvider.getBlockNumber()) + 1;
    }
    const signedBundle = await signer.signBundle(bundle);
    const receipt = await signer.sendBundle(signedBundle, targetBlock);
    await receipt.wait();

    // Get error/success message
    const simulation = await receipt.simulate();
    const bundleHash = simulation.bundleHash;
    if (simulation.error || simulation.firstRevert && simulation.firstRevert.error) {
        console.log('Failed to send flashbots bundle ' + bundleHash + ': ' + simulation.firstRevert.error || simulation.error);
        console.log(simulation);
        return false;
    }
    else {
        console.log('Successfully sent flashbots bundle ' + bundleHash);
        return true;
    }
}

async function simulateBundle(signer, bundle, targetBlock) {
    if (!signer || !(signer instanceof FlashbotsBundleProvider)) {
        throw new Error('Missing or invalid flashbots signer');
    }
    if (!bundle) {
        throw new Error('Missing flashbots bundle');
    }
    if (!targetBlock) {
        targetBlock = (await signer.genericProvider.getBlockNumber()) + 1;
    }
    const signedBundle = await signer.signBundle(bundle);
    const simulation = await signer.simulate(signedBundle, targetBlock);
    if (simulation.error || simulation.firstRevert && simulation.firstRevert.error) {
        console.log('Failed to simulate flashbots bundle: ' + (simulation.error && simulation.error.message || ''));
        console.log(simulation);
        return false;
    } 
    else {
        console.log('Successfully simulated flashbots bundle');
        return true;
    }
}

async function runBundle(bundle, chainId) {
    const prov = await getFbProvider(chainId);
    if (!(await simulateBundle(prov, bundle))) {
        return;
    }

    const close = await streamBlocks(async blockNumber => {
        try {
            const res = await sendBundle(prov, bundle, blockNumber + 1);
            await close();
        }
        catch (err) {
            console.log('Failed to send bundle: ' + err.message);
        }
    }, chainId);
}

async function printPriority(signer) {
    const stats = await signer.getUserStats();
    console.log('Flashbots priority:');
    console.log(JSON.stringify(stats, null, 2));
}

module.exports = {
    getFbProvider,
    sendBundle,
    simulateBundle,
    runBundle,
    printPriority,
};