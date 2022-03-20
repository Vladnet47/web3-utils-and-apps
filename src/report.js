const ethers = require("ethers");
const { TxClassEnum } = require('./enums');

function toJsonSummary(txs, flags) {
    if (!Array.isArray(txs) || !flags) {
        throw new Error('Missing txs');
    }

    const result = {
        totalTxCount: txs.length,
        autoReviewTxCount: 0,
        failedTxCount: 0,
        intTransferTxCount: 0,
        manualReviewTxCount: 0,
        extTransferTxCount: 0,
        writeOffExpense: ethers.BigNumber.from(0)
    };

    for (const tx of txs) {
        const {
            isFail,
            isInternal,
            classification,
            knownFn,
            gasFees,
        } = tx.facts;

        // Adds gas fees for current tx to total expenses
        const expenseFees = () => {
            if (flags.expenseGasFees && !isInternal && gasFees) {
                result.writeOffExpense = result.writeOffExpense.add(gasFees);
            }
        }

        if (isFail) {
            ++result.autoReviewTxCount;
            ++result.failedTxCount;
            expenseFees();
        }
        else if (classification) {
            switch (classification) {
                case TxClassEnum.KNOWN_EXPENSE_FN:
                    expenseFees();
                    ++result.autoReviewTxCount;
                    break;
                case TxClassEnum.INT_TRANSFER:
                    expenseFees();
                    ++result.autoReviewTxCount;
                    ++result.intTransferTxCount;
                    break;
                case TxClassEnum.EXT_TRANSFER:
                    expenseFees();
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
        }
    }

    result.writeOffExpense = ethers.utils.formatEther(result.writeOffExpense);
    return result;
}

module.exports = {
    toJsonSummary
};