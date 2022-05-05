const { notify } = require('../../utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    await notify('Title', 'https://www.google.com', 'Description');
}

main().catch(console.log);