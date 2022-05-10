const ethers = require('ethers');
const LooksEnsurer = require('../../src/apps/looks-farmer/looks-insurer');
const { getAlchemyHttpProv, readConfigs } = require('../../src/utils');

const TX_HASH = '0x7f0cfc6068bf05ab0015545a9daf77a6d8695fe3747b10a4686a49cf16247891';
process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const { privateKeys } = await readConfigs();
    const le = new LooksEnsurer(privateKeys, true);
    await le.load();
    await le.addToken('0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C2d', '0x34d85c9CDeB23FA97cb08333b511ac86E1C4E258', 81312, 12, 0.1);

    const prov = await getAlchemyHttpProv();
    const tx = await prov.getTransaction(TX_HASH);
    await le.handleTx(tx);
}

main().catch(console.log);