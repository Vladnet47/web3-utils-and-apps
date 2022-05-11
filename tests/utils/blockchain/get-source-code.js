const { getContractSourceCode } = require('../../../src/utils');
const fs = require('fs').promises;

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const address = '0x59728544B08AB483533076417FbBB2fD0B17CE3a';
    const sourceCode = await getContractSourceCode(address);
    if (!sourceCode) {
        throw new Error('Missing source code');
    }
    const dir = process.cwd() + '/tests/sourceCode/';
    for (const [name, value] of Object.entries(sourceCode.sources)) {
        const split = name.split('/');
        await fs.writeFile(dir + split[split.length - 1], value.content);
    }
}

main().catch(console.log);