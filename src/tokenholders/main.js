const KycManager = require('./kyc');
const csvToJson = require('csvtojson');

const MAX_CONCURRENT = 300;
const HOLDER_PATH = '/home/vdog/workspace/private/web3-utils/src/tokenholders/csv/holders.csv';
const KYC_PATH = '/home/vdog/workspace/private/web3-utils/src/tokenholders/csv/kyc.csv';
const DB_HOST = '165.227.185.87';
const DB_PORT = 31017;
const DB_DATABASE = 'prodv2';

async function main() {
    const kycManager = new KycManager(KYC_PATH, DB_HOST, DB_PORT, DB_DATABASE);
    await kycManager.load();

    // <= 305, <= 605, <= 1830, > 1830
    const buckets = [0,0,0,0];
    const holders = await getHolders(HOLDER_PATH);
    let i = 0;
    const holderCount = holders.length;
    let tasks = [];

    while (i < holderCount) {
        const taskCount = tasks.length;
        if (taskCount === MAX_CONCURRENT) {
            await Promise.all(tasks);
            console.log('Checked ' + tasks.length + ' wallets');
            tasks = [];
            await kycManager.save();
        }
        else {
            tasks.push((async () => {
                if (!holders[i] || !holders[i]['HolderAddress']) {
                    console.log('ERROR: Holder missing address');
                    return;
                }
                const address = holders[i]['HolderAddress'];
                const tokenCount = holders[i]['Balance'];
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

    if (tasks.length > 0) {
        await Promise.all(tasks);
        console.log('Checked ' + tasks.length + ' wallets');
        tasks = [];
    }

    printBuckets(buckets);
    await kycManager.save();
}

async function getHolders(path) {
    const startTime = new Date();
    const holders = await csvToJson({ trim: true }).fromFile(path);
    console.log('Loaded holders in ' + (new Date() - startTime) + 'ms');
    return holders;
}

function updateBucket(buckets, tokenCount) {
    if (tokenCount <= 305) {
        ++buckets[0];
    }
    else if (tokenCount <= 610) {
        ++buckets[1];
    }
    else if (tokenCount <= 1830) {
        ++buckets[2];
    }
    else {
        ++buckets[3];
    }
}

function printBuckets(buckets) {
    console.log('~ KYC Summary ~');
    console.log('<=305:  ' + buckets[0]);
    console.log('<=610:  ' + buckets[1]);
    console.log('<=1830: ' + buckets[2]);
    console.log('>1830:  ' + buckets[3]);
}

module.exports = main;