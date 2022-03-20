const ethers = require('ethers');

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

// If transaction is a failure, transfer, or known write-off function, mark it as written off.
function identifyWriteOffs(txs) {
    if (!Array.isArray(txs)) {
        throw new Error('Missing txs');
    }
    for (const tx of txs) {
        if (tx.isInternal) {
            continue;
        }
        else if (tx.isError === '1') {
            tx.facts.isWriteOff = true;
            tx.facts.writeOffReason = 'is fail';
        }
        else if (tx.input === '0x') {
            tx.facts.isWriteOff = true;
            tx.facts.writeOffReason = 'is transfer';
        }
        else {
            // Write off known writeoff transactions
            for (let i = 0; i < WRITEOFF_IDS.length; ++i) {
                const fnId = WRITEOFF_IDS[i];
                if (tx.input.startsWith(fnId)) {
                    tx.facts.isWriteOff = true;
                    tx.facts.writeOffReason = 'is known write-off function \'' + WRITEOFF_FNS[i].split('(')[0] + '\'';
                    break;
                }
            }
        }
    }
    return txs;
}

// Calculate and append gas spent on each transaction
function calcGasFees(txs) {
    if (!Array.isArray(txs)) {
        throw new Error('Missing txs');
    }
    for (const tx of txs) {
        if (!tx.facts.isInternal) {
            tx.facts.gasFees = ethers.BigNumber.from(tx.gasPrice).mul(tx.gasUsed);
        }
    }
    return txs;
}

// Sort transactions by timestamp
function sortByTimestamp(txs) {
    if (!Array.isArray(txs)) {
        throw new Error('Missing txs');
    }
    return txs.sort((a, b) => {
        const aTs = parseInt(a.timeStamp);
        const bTs = parseInt(b.timeStamp);
        return aTs - bTs;
    });
}

module.exports = {
    identifyWriteOffs,
    sortByTimestamp,
    calcGasFees,
};