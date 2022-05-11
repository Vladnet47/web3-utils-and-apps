const { getContractSourceCode } = require('../../../src/utils');
const fs = require('fs').promises;

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';
const SOURCE_DIR = process.cwd() + '/tests/sourceCode/';

async function main() {
    const address = '0x59728544B08AB483533076417FbBB2fD0B17CE3a';
    const contracts = await getContractSourceCode(address);
    for (const c of contracts) {
        await fs.writeFile(SOURCE_DIR + c.name, c.code);
    }
}

main().catch(console.log);