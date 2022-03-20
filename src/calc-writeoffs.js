const ethers = require('ethers');

const PARALLEL_REQUESTS = 50;
const WRITEOFF_FNS = [
    'setApprovalForAll(address,bool)',
    'registerProxy()',
    'atomicMatch_(address[14],uint256[18],uint8[8],bytes,bytes,bytes,bytes,bytes,bytes,uint8[2],bytes32[5])',
    'transferFrom(address,address,uint256)',
    'safeTransferFrom(address,address,uint256,uint256,bytes)',
    'safeTransferFrom(address,address,uint256,bytes)',
    'safeTransferFrom(address,address,uint256)',
    'atomicize(address[],uint256[],uint256[],bytes)',
    'matchERC1155UsingCriteria(address,address,address,uint256,uint256,bytes32,bytes32[])',
    'matchERC721UsingCriteria(address,address,address,uint256,bytes32,bytes32[])',
    'matchERC721WithSafeTransferUsingCriteria(address,address,address,uint256,bytes32,bytes32[])'
];
const WRITEOFF_IDS = WRITEOFF_FNS.map(fn => {
    const fragment = ethers.utils.Fragment.from('function ' + fn);
    const sig = fragment.format(ethers.utils.FormatTypes.sighash);
    return ethers.utils.id(sig).substring(0,10).toLowerCase();
});

async function calcWriteOffs(provider, txs) {
    if (!provider || !Array.isArray(txs)) {
        throw new Error('Missing provider or txs');
    }

    const excludedTxs = [];

    // Calculate gas cost for each writeoff tx
    const tasks = [];
    for (const tx of txs) {
        if (tx && !tx.internal) {
            if (tx.isError === '1') {
                // Write off failed txs
                tasks.push(getTxGasUsage(provider, tx.hash, 'is failed tx'));
                continue;
            }
            else if (tx.input === '0x') {
                // Write off transfers
                tasks.push(getTxGasUsage(provider, tx.hash, 'is transfer'));
                continue;
            }
            else {
                // Write off known writeoff transactions
                let found = false;
                for (let i = 0; i < WRITEOFF_IDS.length; ++i) {
                    const fnId = WRITEOFF_IDS[i];
                    if (tx.input.startsWith(fnId)) {
                        tasks.push(getTxGasUsage(provider, tx.hash, 'is writeoff fn ' + WRITEOFF_FNS[i].split('(')[0]));
                        found = true;
                        break;
                    }
                }
                if (found) {
                    continue;
                }
            }
        }

        excludedTxs.push(tx);
    }

    const results = [];
    for (let i = 0; i < tasks.length; i += PARALLEL_REQUESTS) {
        const curTasks = [];
        for (let j = 0; j < PARALLEL_REQUESTS; ++j) {
            curTasks.push(tasks[i + j]);
        }
        const curResults = await Promise.all(curTasks);
        for (const curResult of curResults) {
            results.push(curResult);
        }
    }

    // Combine gas costs
    let gasCost = ethers.BigNumber.from(0);
    for (const result of results) {
        if (result) {
            gasCost = gasCost.add(result);
        }
    }

    return {
        excludedTxs,
        gasCost
    };
}

async function getTxGasUsage(provider, hash, reason) {
    if (!provider || !hash) {
        throw new Error('Missing provider or hash');
    }
    try {
        const receipt = await provider.getTransactionReceipt(hash);
        if (receipt) {
            console.log('Wrote off tx ' + hash + (reason ? ': ' + reason : ''));
            return receipt.effectiveGasPrice.mul(receipt.gasUsed);
        }
        throw new Error('Receipt is null');
    }
    catch (err) {
        console.log('Failed to get receipt for ' + hash + ': ' + err.message);
        return null;
    }
}

module.exports = calcWriteOffs;