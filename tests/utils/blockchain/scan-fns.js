const { scanFns } = require('../../../utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const address = '0xbce6d2aa86934af4317ab8615f89e3f9430914cb';
    const fns = await scanFns(address);
    console.log(JSON.stringify(fns, null, 2));
}

main().catch(console.log);