const ethers = require('ethers');
const { TxClassEnum } = require('./enums');

const KNOWN_FNS = [
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
const KNOWN_IDS = KNOWN_FNS.map(fn => {
    const fragment = ethers.utils.Fragment.from('function ' + fn);
    const sig = fragment.format(ethers.utils.FormatTypes.sighash);
    return ethers.utils.id(sig).substring(0,10).toLowerCase();
});

// If transaction is a failure, transfer, or known write-off function, mark it as written off.
function classify(txs, wallets) {
    if (!Array.isArray(txs) || !Array.isArray(wallets)) {
        throw new Error('Missing txs');
    }
    for (const tx of txs) {
        if (tx.isInternal) {
            continue;
        }
        else {
            if (tx.isError === '1') {
                tx.facts.isFail = true;
            }
            else if (tx.input === '0x') {
                tx.facts.classification = wallets.includes(tx.to.toLowerCase()) ? TxClassEnum.INT_TRANSFER : TxClassEnum.EXT_TRANSFER;
            }
            else {
                for (let i = 0; i < KNOWN_FNS.length; ++i) {
                    if (tx.input.startsWith(KNOWN_IDS[i])) {
                        tx.facts.classification = TxClassEnum.KNOWN_EXPENSE_FN;
                        tx.facts.knownFn = KNOWN_FNS[i].split('(')[0];
                        break;
                    }
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
    classify,
    sortByTimestamp,
    calcGasFees,
};