const ethers = require('ethers');
const { getFbProvider, sendBundle, simulateBundle, runBundle, printPriority, createTx, getAlchemyHttpsProv, readConfigs, getAddressDetails } = require('../../src/utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const { privateKeys } = await readConfigs();
    const prov = await getAlchemyHttpsProv();
    const signer = new ethers.Wallet(privateKeys.vdog1, prov);
    const { nonce } = await getAddressDetails(prov, signer.address);
    const fbProv = await getFbProvider();
    const bundle = [
        {
            signer: new ethers.Wallet(privateKeys.vdog1, prov),
            transaction: createTx('0xb1ecEAC15426935300EC00A43945E51510226551', 200, 1.52, 21000, 10.3, null, nonce)
        }
    ];
    await printPriority(fbProv);
    await simulateBundle(fbProv, bundle);
}

main().catch(console.log);