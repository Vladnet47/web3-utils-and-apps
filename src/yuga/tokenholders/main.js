const KycManager = require('./kyc');
const csvToJson = require('csvtojson');
const { ethers } = require('ethers');

const MAX_CONCURRENT = 300;
const HOLDER_PATH = '/home/vdog/workspace/private/web3-utils/src/yuga/tokenholders/csv/holders.csv';
const KYC_PATH = '/home/vdog/workspace/private/web3-utils/src/yuga/tokenholders/csv/kyc.csv';
const DB_HOST = '165.227.185.87';
const DB_PORT = 31017;
const DB_DATABASE = 'prodv2';

async function main() {
    const kycManager = new KycManager(KYC_PATH, DB_HOST, DB_PORT, DB_DATABASE);
    await kycManager.load();
    const provider = new ethers.providers.JsonRpcProvider('http://eth-mainnet.alchemyapi.io/v2/_lXNVI-yluBd4gZadFNQj9LTPnKEOWW5');

    const countBuckets = [];
    const balanceBuckets = [];
    for (let i = 0; i < 13; ++i) {
        countBuckets.push(0);
        balanceBuckets.push(ethers.BigNumber.from(0));
    }
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
            //await kycManager.save();
        }

        if (!holders[i] || !holders[i]['HolderAddress']) {
            console.log('ERROR: Holder missing address');
            continue;
        }
        const address = holders[i]['HolderAddress'];
        const tokenCount = holders[i]['Balance'];

        tasks.push((async () => {
            try {
                const isKyc = await kycManager.isKyc(address);
                if (isKyc) {
                    //const balance = await provider.getBalance(address);
                    updateBucket(countBuckets, tokenCount, balanceBuckets, ethers.BigNumber.from(0));
                }
            }
            catch (err) {
                console.log('ERROR: failed to update count for address ' + address + ': ' + err.message);
            }
        })());

        // if (kycManager.isCached(address)) {
        //     const isKyc = await kycManager.isKyc(address);
        //     if (isKyc) {
        //         updateBucket(countBuckets, tokenCount, balanceBuckets, balance);
        //     }
        // }
        // else {
        //     tasks.push((async () => {
        //         try {
        //             const isKyc = await kycManager.isKyc(address);
        //             if (isKyc) {
        //                 const balance = await provider.getBalance(address);
        //                 updateBucket(countBuckets, tokenCount, balanceBuckets, balance);
        //             }
        //         }
        //         catch (err) {
        //             console.log('ERROR: failed to update count for address ' + address + ': ' + err.message);
        //         }
        //     })());
        // }
        ++i;
    }

    if (tasks.length > 0) {
        await Promise.all(tasks);
        console.log('Checked ' + tasks.length + ' wallets');
        tasks = [];
    }

    printBuckets(countBuckets, balanceBuckets);
    await kycManager.save();
}

async function getHolders(path) {
    const startTime = new Date();
    const holders = await csvToJson({ trim: true }).fromFile(path);
    console.log('Loaded holders in ' + (new Date() - startTime) + 'ms');
    return holders;
}

function updateBucket(countBuckets, tokenCount, balanceBuckets, balance) {
    let bucketI = Math.floor(tokenCount / 305);
    if (bucketI > countBuckets.length - 1) {
        bucketI = countBuckets.length - 1;
    } 
    balanceBuckets[bucketI] = balanceBuckets[bucketI].mul(countBuckets[bucketI]).add(balance).div(countBuckets[bucketI] + 1);
    ++countBuckets[bucketI];
}

function printBuckets(countBuckets, balanceBuckets) {
    console.log('----- Wallets with KYC that have APE -----');
    let total = 0;
    for (let i = 0; i < countBuckets.length; ++i) {
        const count = countBuckets[i];
        const avgBal = balanceBuckets[i];
        const bucket = 305 * (i);
        total += count;
        if (i === 0) {
            console.log('< 305: ' + count /*+ ' (' + (Math.round(parseFloat(ethers.utils.formatEther(avgBal)) * 10) / 10) + 'Ξ)'*/);
        }
        else {
            console.log('>= ' + bucket + ':  ' + count /*+ ' (' + (Math.round(parseFloat(ethers.utils.formatEther(avgBal)) * 10) / 10) + 'Ξ)'*/);
        }
    }
    console.log('Total: ' + total);
    console.log();

    const wave1Tokens = countBuckets[1] 
        + countBuckets[2] * 2 
        + countBuckets[3] * 2 
        + countBuckets[4] * 2 
        + countBuckets[5] * 2 
        + countBuckets[6] * 2
        + countBuckets[7] * 2
        + countBuckets[8] * 2
        + countBuckets[9] * 2
        + countBuckets[10] * 2
        + countBuckets[11] * 2
        + countBuckets[12] * 2;
    const wave2Tokens = countBuckets[3] 
        + countBuckets[4] * 2 
        + countBuckets[5] * 3 
        + countBuckets[6] * 4
        + countBuckets[7] * 4
        + countBuckets[8] * 4
        + countBuckets[9] * 4
        + countBuckets[10] * 4
        + countBuckets[11] * 4
        + countBuckets[12] * 4;
    console.log('----- Max tokens minted per wave, out of 55k -----');
    console.log('Wave 1: ' + wave1Tokens);
    console.log('Wave 2: ' + wave2Tokens);
    console.log('Total: ' + (wave1Tokens + wave2Tokens) + ' (' + (Math.round((wave1Tokens + wave2Tokens) / 55000 * 100)) + '%)');
}

module.exports = main;