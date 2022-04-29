const KycManager = require('./kyc');
const csvToJson = require('csvtojson');

const MAX_CONCURRENT = 100;
const HOLDER_PATH = '/home/vdog/workspace/private/web3-utils/src/tokenholders/csv/holders4.csv';
const KYC_PATH = '/home/vdog/workspace/private/web3-utils/src/tokenholders/csv/kyc.csv';
const DB_HOST = '165.227.185.87';
const DB_PORT = 31017;
const DB_DATABASE = 'prodv2';

async function main() {
    const kycManager = new KycManager(KYC_PATH, DB_HOST, DB_PORT, DB_DATABASE);
    await kycManager.load();

    // <= 305, <= 605, <= 1830, > 1830
    const buckets = [0,0,0,0,0,0,0];
    const holders = await getHolders(HOLDER_PATH);
    let i = 0;
    const holderCount = holders.length;
    let tasks = [];

    while (i < holderCount) {
        const taskCount = tasks.length;
        if (taskCount === MAX_CONCURRENT) {
            await Promise.all(tasks);
            const percChecked = Math.round(i / holderCount * 100);
            console.log('Checked ' + i + ' wallets (' + percChecked + '%)');
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
    let bucketI = Math.floor(tokenCount / 305);
    if (bucketI > 6) {
        bucketI = 6;
    } 
    ++buckets[bucketI];
}

function printBuckets(buckets) {
    console.log('----- Wallets with KYC that have APE -----');
    let total = 0;
    for (let i = 0; i < buckets.length; ++i) {
        const count = buckets[i];
        const bucket = 305 * (i);
        total += count;
        if (i === 0) {
            console.log('< 305: ' + count);
        }
        else {
            console.log('>= ' + bucket + ':  ' + count);
        }
    }
    console.log('Total: ' + total);
    console.log();

    console.log('----- Max tokens minted per wave -----');
    console.log('Wave 1: ' + (buckets[1] + buckets[2] * 2 + buckets[3] * 2 + buckets[4] * 2 + buckets[5] * 2 + buckets[6] * 2));
    console.log('Wave 2: ' + (buckets[3] + buckets[4] * 2 + buckets[5] * 3 + buckets[6] * 4));
}

module.exports = main;