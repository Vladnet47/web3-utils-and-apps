const ethers = require("ethers");

function toJsonSummary(txs) {
    if (!Array.isArray(txs)) {
        throw new Error('Missing txs');
    }

    const result = {
        totalTxCount: txs.length,
        regularTxCount: 0,
        internalTxCount: 0,
        autoReviewTxCount: 0,
        manualReviewTxCount: 0,
        writeOffFees: ethers.BigNumber.from(0)
    };

    for (const tx of txs) {
        const {
            isInternal,
            isWriteOff,
            gasFees,
        } = tx.facts;

        if (isInternal) {
            ++result.internalTxCount;
            ++result.manualReviewTxCount;
        }
        else {
            ++result.regularTxCount;
            if (isWriteOff) {
                ++result.autoReviewTxCount;
                if (gasFees) {
                    result.writeOffFees = result.writeOffFees.add(gasFees);
                }
            }
            else {
                ++result.manualReviewTxCount;
            }
        }
    }

    result.writeOffFees = ethers.utils.formatEther(result.writeOffFees);

    return result;
}

module.exports = {
    toJsonSummary
};