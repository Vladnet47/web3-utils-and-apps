const ethers = require('ethers');
const { getAlchemyHttpProv } = require('../common');

const TOKEN_COUNT_IFACE = new ethers.utils.Interface([
    'function totalSupply() view returns(uint256)',
]);

const TOKEN_ID_IFACE = new ethers.utils.Interface([
    'function tokenByIndex(uint256) view returns(uint256)',
]);

const TOKEN_URI_IFACE = new ethers.utils.Interface([
    'function tokenURI(uint256) view returns(string)',
    'function uri(uint256) view returns(string)'
]);

// Scans details about tokens, including token ids, uri, and traits. Returns array of token data
// Opts can accept count, uri
async function scanTokens(address, chainId, opts = {}) {
    if (!address) {
        throw new Error('Missing address');
    }

    const prov = await getAlchemyHttpProv(chainId);
    const ids = await getTokenIds(contract, opts.count);
    const uris = await getTokenUris(contract, ids, opts.uri);

    const tokens = [{
        name: null,
        uri: null,
        imageUrl: null,
        traits: []
    }];

    return tokens;
}

// Returns token count of contract, if found. Returns max count from specified count interface.
async function getTokenCount(prov, address) {
    if (!prov) {
        throw new Error('Missing rpc provider');
    }
    if (!address) {
        throw new Error('Missing address');
    }
    const contract = new ethers.Contract(address, TOKEN_COUNT_IFACE, prov);
    const counts = await Promise.all(TOKEN_COUNT_IFACE.fragments.map(f => contract[f.format()]()));

    let max = 0;
    for (const count of counts) {
        if (count) {
            const parsed = parseInt(count._isBigNumber ? count.toString() : count);
            if (parsed > max) {
                max = parsed;
            }
        }
    }

    return max;
}

async function getTokenIds(contract, count) {
    count ||= await getTokenCount(contract, address);
    if (!count) {
        return [];
    }
    const ids = [];
    for (let i = 0; i < count; ++i) {
        ids.push(i);
    }
    return ids;
}

async function getTokenUris(contract, tokenIds, uri) {
    if (!Array.isArray(tokenIds)) {
        throw new Error('Missing token ids');
    }
    return await Promise.all(tokenIds, id => getTokenUri(contract, id, uri));
}

async function getTokenUri(contract, tokenId, uri) {
    if (tokenId == null) {
        throw new Error('Missing token id');
    }

    // If uri provided by user, replace <token> with id
    if (uri) {
        if (uri.includes('<token>')) {
            return uri.replace('<token>', tokenId);
        }
        else {
            throw new Error('Token uri missing token id slot to replace');
        }
    }
    else {
        // Otherwise, get token uri from contract
        if (!contract) {
            throw new Error('Missing contract');
        }
        const uris = await Promise.all([
            contract.callStatic.uri(tokenId),
            contract.callStatic.tokenURI(tokenId),
        ]);
        for (const uri of uris) {
            if (uri) {
                return uri;
            }
        }
    }
}

// Returns token uri scraped or null if not found
// Returns image url, as well as any additional requested fields (if found)
async function scrapeTokenUri(uri, tokenContract, tokenId, fields = [], logger) {
    if (!tokenContract || tokenId == null || !Array.isArray(fields) || !logger) {
        throw new Error('Missing required parameters');
    }

    const result = {};
    const updateResult = json => {
        if (json) {
            for (const field of fields) {
                if (field !== 'image' && !result[field] && json[field]) {
                    result[field] = json[field];
                }
            }
        }
    };

    const defaultEtherscanApi = 'https://storage.googleapis.com/nftimagebucket/tokens/' + tokenContract + '/' + tokenId + '.png';
    const paddedTokenId = tokenId != null ? ethers.utils.hexZeroPad(ethers.utils.hexlify(ethers.BigNumber.from(tokenId)), 64) : '';

    while (uri) {
        if (uri.startsWith('data:')) {
            if (uri.includes('json')) {
                const buffer = Buffer.from(uri.substring(29), 'base64');
                const json = JSON.parse(buffer.toString());
                uri = json.image;
                updateResult(json);
            }
            else {
                logger.warn({ message: 'Encountered on-chain nft, unable to get image link', data: uri });
                uri = null;
                break;
            }
        }
        else if (uri.includes('{id}')) {
            uri = uri.replace('{id}', paddedTokenId);
        }
        else {
            uri = ensureIpfs(uri);
            if (isImageUrl(uri)) {
                break;
            }

            try {
                const json = await got(uri, {
                    method: 'GET',
                    timeout: 2000,
                    resolveBodyOnly: true,
                    responseType: 'json',
                    retry: 0
                });

                uri = json.image;
                updateResult(json);
            }
            catch (err) {
                switch (err.code) {
                    // This commonly indicates that the uri is an image, since it can't be parsed as json
                    case 'ERR_BODY_PARSE_FAILURE': break;
                    default:
                        logger.error({ message: 'Failed to retrieve image url ' + uri, error: err.message });
                        uri = null;
                }
                
                break;
            }
        }
    }

    result.image = ensureIpfs(uri) || defaultEtherscanApi;
    return result;
}

function ensureIpfs(uri) {
    if (uri) {
        if (uri.startsWith('https://ipfs.io')) {
            return 'https://marketplace.treasure.lol/_next/image?url=' + uri + '&w=3840&q=75';
        }
        else if (uri.startsWith('ipfs://')) {
            uri = uri.substring(7);
            return 'https://marketplace.treasure.lol/_next/image?url=https://ipfs.io/' + (uri.startsWith('ipfs/') ? uri : 'ipfs/' + uri) + '&w=3840&q=75';
        }
    }
    
    return uri;
}

module.exports = scanTokens;