const { HttpRequests } = require('../../src/utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const req = new HttpRequests(true);
    console.log(await req.get('https://www.google.com', null, 'text'));
}

main().catch(console.log);