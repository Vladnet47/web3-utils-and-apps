const { streamBlocks, printTx } = require('../../../src/utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const cb = async blockNum => {
        console.log(blockNum);
    }
    const close = await streamBlocks(cb);
    //await close();
}

main().catch(console.log);