const { scanTxs } = require('../../../utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const address = '0xbce6d2aa86934af4317ab8615f89e3f9430914cb';
    let counter = 0;
    const cb = async tx => {
        ++counter;
        console.log(counter + ': ' + tx.blockNumber + ' ' + tx.hash);
    }
    const close = await scanTxs(address, cb);
    await close();
}

main().catch(console.log);