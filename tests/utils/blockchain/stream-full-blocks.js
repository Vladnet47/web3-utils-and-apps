const { streamFullBlocks, printTx } = require('../../../src/utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const cb = async block => {
        console.log(block);
    }
    const close = await streamFullBlocks(cb);
    //await close();
}

main().catch(console.log);