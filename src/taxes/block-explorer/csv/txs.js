const { ethers } = require("ethers");

class Transaction {
    constructor(hash, ts, to, from, description, status, value, fees, ethPrice) {
        if (!hash) {
            throw new Error('Missing hash');
        }
        if (status == null) {
            throw new Error('Missing status');
        }
        if (!ts) {
            throw new Error('Missing timestamp');
        }
        if (!to) {
            throw new Error('Missing to address');
        }
        if (!from) {
            throw new Error('Missing from address');
        }
        if (value && !value._isBigNumber) {
            throw new Error('Invalid transaction value');
        }
        if (fees && !fees._isBigNumber) {
            throw new Error('Invalid transaction fees');
        }

        this.hash = hash.toLowerCase();
        this.status = status === true;
        this.description = description ? description.toLowerCase() : '';
        this.ts = new Date(parseInt(ts) * 1000);
        this.to = to.toLowerCase();
        this.from = from.toLowerCase();
        this._value = value || ethers.BigNumber.from(0);
        this._fees = fees || ethers.BigNumber.from(0);
        this._ethPrice = ethPrice ? Math.round(parseFloat(ethPrice)) : null;
        this._isWriteoff = false;
    }

    get isWriteoff() {
        return this._isWriteoff;
    }

    get cost() {
        return ethers.utils.formatEther(ethers.utils.parseEther(this.value).add(ethers.utils.parseEther(this.fees)));
    }

    get ethPrice() {
        return this._ethPrice;
    }

    set ethPrice(value) {
        if (!value) {
            throw new Error('Invalid eth price');
        }
        this._ethPrice = parseFloat(value);
    }

    get value() {
        return ethers.utils.formatEther(this._value);
    }

    get fees() {
        return ethers.utils.formatEther(this._fees);
    }

    markAsWriteoff() {
        this._isWriteoff = true;
    }
}

class TokenTransaction extends Transaction {
    constructor(hash, ts, to, from, description, tokenAmount) {
        super(hash, ts, to, from, description, true)
        this.tokenAmount = tokenAmount;
    }

    async updateCost(provider) {
        if (!provider) {
            throw new Error('Missing provider');
        }
        const tx = await provider.getTransaction(this.hash);
        this._value = ethers.BigNumber.from(tx.value);
        this._fees = ethers.BigNumber.from(0);
    }
}

module.exports = {
    Transaction,
    TokenTransaction,
};