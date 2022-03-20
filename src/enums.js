
const TxClassEnum = Object.freeze({
    UNCLASSIFIED: 0,
    INT_TRANSFER: 1,    // Transfer to/from user-specified wallets
    EXT_TRANSFER: 2,    // Transfer to/from external wallets
    TOKEN_PURCHASE: 4, 
    TOKEN_SALE: 5,
    KNOWN_EXPENSE_FN: 6
});

module.exports = {
    TxClassEnum
};