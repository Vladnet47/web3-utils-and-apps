const { streamPendingTxs, printTx } = require('../../../src/utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const address = '0x160c404b2b49cbc3240055ceaee026df1e8497a0';
    const cb = async tx => {
        printTx(tx);
    }
    const close = await streamPendingTxs(address, cb);
    //await close();
}

main().catch(console.log);