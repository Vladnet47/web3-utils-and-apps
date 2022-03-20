const ethers = require("ethers");
const { TxClassEnum } = require('./enums');

function toSummary(txs, flags) {
    if (!Array.isArray(txs) || !flags) {
        throw new Error('Missing txs');
    }

    const result = {
        totalTxCount: txs.length,
        autoReviewTxCount: 0,
        failedTxCount: 0,
        knownFnTxCount: 0,
        intTransferTxCount: 0,
        manualReviewTxCount: 0,
        unclassifiedTxCount: 0,
        extTransferTxCount: 0,
        gasFees: ethers.BigNumber.from(0)
    };

    for (const tx of txs) {
        const {
            isFail,
            isInternal,
            classification,
            knownFn,
            gasFees,
        } = tx.facts;

        // Add gas fees
        if (!isInternal && gasFees) {
            result.gasFees = result.gasFees.add(gasFees);
        }

        if (isFail) {
            ++result.autoReviewTxCount;
            ++result.failedTxCount;
        }
        else if (classification) {
            switch (classification) {
                case TxClassEnum.KNOWN_EXPENSE_FN:
                    ++result.autoReviewTxCount;
                    ++result.knownFnTxCount;
                    break;
                case TxClassEnum.INT_TRANSFER:
                    ++result.autoReviewTxCount;
                    ++result.intTransferTxCount;
                    break;
                case TxClassEnum.EXT_TRANSFER:
                    ++result.manualReviewTxCount;
                    ++result.extTransferTxCount;
                    break;
                case TxClassEnum.TOKEN_PURCHASE:
                case TxClassEnum.TOKEN_SALE:
                default: throw new Error('Unknown tx classification: ' + classification);
            }
        }
        else {
            ++result.manualReviewTxCount;
            ++result.unclassifiedTxCount;
        }
    }

    return '' +
        'Total txs: ' + result.totalTxCount + '\n' +
        'Txs automatically processed: ' + result.autoReviewTxCount + '\n' +
        '   Failed: ' + result.failedTxCount + '\n' +
        '   Internal transfers: ' + result.intTransferTxCount + '\n' +
        '   Known function calls: ' + result.knownFnTxCount + '\n' +
        'Txs marked for manual review: ' + result.manualReviewTxCount + '\n' +
        '   Unclassified: ' + result.unclassifiedTxCount + '\n' +
        '   External transfers: ' + result.extTransferTxCount + '\n' +
        'Gas fees: ' + ethers.utils.formatEther(result.gasFees);
}

module.exports = {
    toSummary
};