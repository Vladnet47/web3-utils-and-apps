const got = require('got');

// Returns array of all txs for given wallets, both external and internal
async function scan(etherscanKey, wallets, startBlock, endBlock) {
    const encounteredHashes = new Set();
    const allTxs = [];

    // Scan each wallet individually to avoid etherscan rate limit
    for (const wallet of wallets) {
        await Promise.all([
            (async () => {
                // Scan regular txs
                try {
                    const txs = await getRegularTxs(etherscanKey, wallet, startBlock, endBlock);
                    for (const tx of txs) {
                        if (tx && !encounteredHashes.has(tx.hash)) {
                            allTxs.push({ ...tx, facts: {} });
                            encounteredHashes.add(tx.hash);
                        }
                    }
                    console.log('Scanned ' + txs.length + ' regular txs for ' + wallet);
                }
                catch (err) {
                    console.log('Failed to scan regular txs for ' + wallet + ': ' + err.message);
                }
            })(),
            (async () => {
                // Scan internal txs
                try {
                    const txs = await getInternalTxs(etherscanKey, wallet, startBlock, endBlock);
                    for (const tx of txs) {
                        if (tx && !encounteredHashes.has(tx.hash)) {
                            allTxs.push({ ...tx, facts: { isInternal: true } });
                            encounteredHashes.add(tx.hash);
                        }
                    }
                    console.log('Scanned ' + txs.length + ' internal txs for ' + wallet);
                }
                catch (err) {
                    console.log('Failed to scan internal txs for ' + wallet + ': ' + err.message);
                }
            })()
        ]);
    }

    return allTxs;
}

async function getRegularTxs(etherscanKey, address, startBlock, endBlock) {
    if (!etherscanKey || !address) {
        throw new Error('Missing etherscan key or wallet address');
    }
    const blockQuery = getBlockQueryStr(startBlock, endBlock);
    const url = 'https://api.etherscan.io/api?module=account&action=txlist&address=' + address + (blockQuery ? '&' + blockQuery : '') + '&sort=asc&apikey=' + etherscanKey;
    const response = await got.get(url, { 
        responseType: 'json', 
        timeout: 10000, 
        retry: 0 
    });
    const body = response.body;
    if (body.status !== '1') {
        throw new Error(body.message);
    }
    const txList = body.result;
    return txList;
}

async function getInternalTxs(etherscanKey, address, startBlock, endBlock) {
    if (!etherscanKey || !address) {
        throw new Error('Missing etherscan key or wallet address');
    }
    const blockQuery = getBlockQueryStr(startBlock, endBlock);
    const url = 'https://api.etherscan.io/api?module=account&action=txlistinternal&address=' + address + (blockQuery ? '&' + blockQuery : '') + '&sort=asc&apikey=' + etherscanKey;
    const response = await got.get(url, { 
        responseType: 'json', 
        timeout: 10000, 
        retry: 0 
    });
    const body = response.body;
    if (body.status !== '1') {
        throw new Error(body.message);
    }
    const txList = body.result;
    return txList;
}

function getBlockQueryStr(startBlock, endBlock) {
    let result = '';
    if (startBlock) {
        result += 'startblock=' + startBlock;
    }
    if (endBlock) {
        result += (result ? '&' : '') + 'endblock=' + endBlock;
    }
    return result;
}

module.exports = scan;