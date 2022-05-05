const ethers = require('ethers');
const { createTx, printTx, encodeTx, encodeTxData, getAlchemyHttpsProv, readConfigs } = require('../../../src/utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const { privateKeys } = await readConfigs();
    const tx = createTx('0x160c404b2b49cbc3240055ceaee026df1e8497a0', 150, 2, 21000, 0.05, encodeTxData('mint(uint256)', [3]), 0);
    printTx(tx);
    const prov = await getAlchemyHttpsProv();
    const signer = new ethers.Wallet(privateKeys.test, prov);
    const signed = await signer.signTransaction(tx);
    console.log(signed);
}

main().catch(console.log);