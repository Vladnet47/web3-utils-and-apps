const ethers = require('ethers');
const { parseCmds, getAlchemyHttpProv, getTokenCount } = require("../../utils");

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

const CONC_PROV_REQUESTS = 500;

const COUNT_IFACE = new ethers.utils.Interface([
    'function totalSupply() view returns(uint256)'
]);

const TOKEN_ID_IFACE = new ethers.utils.Interface([
    'function tokenByIndex(uint256) view returns(uint256)'
]);

const URI_IFACE = new ethers.utils.Interface([
    'function tokenURI(uint256) view returns(string)'
]);

async function main() {
    const { address, count, uri } = parseCmds();
    if (!address) {
        throw new Error('Missing address');
    }

    const prov = await getAlchemyHttpProv();
    const tokens = new Map();
    await updateTokenIds(tokens, prov, address, count);
    await updateTokenUris(tokens, prov, address, uri);
}

async function updateTokenIds(tokens, prov, address, count) {
    if (!tokens) {
        throw new Error('Missing tokens map');
    }
    if (!address) {
        throw new Error('Missing address');
    }
    count ||= await getTokenCount(address);
    for (let i = 0; i < count; ++i) {
        tokens.set(i, {});
    }
}

async function updateTokenUris(tokens, prov, address, uri) {
    const tokenIds = Array.from(tokens.keys());
    const uris = uri ? getUris(uri, tokenIds) : await getUrisAbi(prov, address, tokenIds);
    // for (const uri of uris) {
    //     tokens
    // }
}

function getUris(uri, tokenIds) {
    if (!uri || !uri.includes('<token>')) {
        throw new Error('Missing or invalid uri');
    }
    return tokenIds.map(id => uri.replace('<token>', id.toString()));
}

async function getUrisAbi(prov, address, tokenIds) {
    const contract = new ethers.Contract(address, URI_IFACE, prov);
    const uris = new Map();

    let tasks = [];
    for (let i = 0; i < total; ++i) {
        tasks.push((async () => {
            try {
                uris.set(i, await contract.callStatic.tokenURI(i));
            } catch (err) {
                console.log('Failed to retrieve token uri: ' + err.message);
            }
        })());
    }

    return uris;
}

main().catch(console.log);