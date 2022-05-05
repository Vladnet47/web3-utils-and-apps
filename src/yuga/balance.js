const ethers = require('ethers');

const MAX_CONCURRENT = 200;
const PROVIDER = new ethers.providers.JsonRpcProvider('');

async function getBalanceMap(holders, path) {
    const result = new Map();
    const holderCount = holders.length;
    const tasks = [];

    let i = 0;
    while (i < holderCount) {
        const taskCount = tasks.length;
        if (taskCount === MAX_CONCURRENT) {
            await Promise.all(tasks);
            const percChecked = Math.round(i / holderCount * 100);
            console.log('Got balance for ' + i + ' wallets (' + percChecked + '%)');
            tasks = [];
            await kycManager.save();
        }

        if (!holders[i] || !holders[i]['HolderAddress']) {
            console.log('ERROR: Holder missing address');
            continue;
        }
        const address = holders[i]['HolderAddress'];
        const tokenCount = holders[i]['Balance'];

        if (kycManager.isCached(address)) {
            const isKyc = await kycManager.isKyc(address);
            if (isKyc) {
                updateBucket(buckets, tokenCount);
            }
        }
        else {
            tasks.push((async () => {
                try {
                    const isKyc = await kycManager.isKyc(address);
                    if (isKyc) {
                        updateBucket(buckets, tokenCount);
                    }
                }
                catch (err) {
                    console.log('ERROR: failed to update count for address ' + address + ': ' + err.message);
                }
            })());
        }
        ++i;
    }

}