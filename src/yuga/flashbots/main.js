const ethers = require('ethers');
const fs = require('fs').promises;
const BundleManager = require('./bundle');

const DEBUG = true;

async function main() {
    if (!process.env.CONFIG_PATH) {
        console.log('Missing CONFIG_PATH environment variable');
        return;
    }

    const {
        endpoint,
        address,
        mintFnAbi,
        bundles 
    } = await load(process.env.CONFIG_PATH);

    const p = new ethers.providers.JsonRpcProvider('https://' + endpoint);
    await p.ready();

    const bm = new BundleManager(p, address, mintFnAbi);
    await Promise.all(bundles.map(bm.addBundle));

    p.on('block', bn => bm.send(bn + 1, DEBUG));
}

async function load(path) {
    if (!(await fileExists(path))) {
        throw new Error('File ' + path + ' does not exist');
    }
    return JSON.parse((await fs.readFile(path)).toString());
}

async function fileExists() {
    try {
        await fs.access(this._path);
        return true;
    }
    catch (err) {
        return false;
    }
}

module.exports = main;