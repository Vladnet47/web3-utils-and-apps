const got = require('got');

async function scanTxs(etherscanKey, wallets) {
    const allTxs = [];

    // Scan each wallet individually to avoid etherscan rate limit
    for (const wallet of wallets) {
        // Scan regular txs
        try {
            const txs = await getRegularTxs(etherscanKey, wallet);
            for (const tx of txs) {
                allTxs.push({ ...tx, internal: false });
            }
            console.log('Successfully retrieved ' + txs.length + ' regular txs for ' + wallet);
        }
        catch (err) {
            console.log('Failed to retrieve regular txs for ' + wallet);
        }

        // Scan internal txs
        try {
            const txs = await getInternalTxs(etherscanKey, wallet);
            for (const tx of txs) {
                allTxs.push({ ...tx, internal: true });
            }
            console.log('Successfully retrieved ' + txs.length + ' internal txs for ' + wallet);
        }
        catch (err) {
            console.log('Failed to retrieve internal txs for ' + wallet);
        }
    }

    allTxs.sort((a, b) => {
        const aTs = parseInt(a.timeStamp);
        const bTs = parseInt(b.timeStamp);
        return aTs - bTs;
    });

    return allTxs;
}

async function getRegularTxs(etherscanKey, address) {
    if (!etherscanKey || !address) {
        throw new Error('Missing etherscan key or wallet address');
    }
    const response = await got.get('https://api.etherscan.io/api?module=account&action=txlist&address=' + address + '&sort=asc&apikey=' + etherscanKey, { 
        responseType: 'json', 
        timeout: 10000, 
        retry: 0 
    });
    const body = response.body;
    if (body.status !== '1') {
        throw new Error('Failed to retrieve regular txs for ' + address + ':' + body.message);
    }
    const txList = body.result;
    return txList;
}

async function getInternalTxs(etherscanKey, address) {
    if (!etherscanKey || !address) {
        throw new Error('Missing etherscan key or wallet address');
    }
    const response = await got.get('https://api.etherscan.io/api?module=account&action=txlistinternal&address=' + address + '&sort=asc&apikey=' + etherscanKey, { 
        responseType: 'json', 
        timeout: 10000, 
        retry: 0 
    });
    const body = response.body;
    if (body.status !== '1') {
        throw new Error('Failed to retrieve regular txs for ' + address + ':' + body.message);
    }
    const txList = body.result;
    return txList;
}

module.exports = scanTxs;