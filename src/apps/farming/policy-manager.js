const ethers = require('ethers');
const { readCsv, writeCsv, existsFile } = require('../../utils');
const { Token } = require('./objects');

class PolicyManager {
    constructor(savePath) {
        if (!savePath) {
            throw new Error('Missing save path');
        }
        this._savePath = savePath;
        this._policies = new Map();
    }

    get policies() {
        return Array.from(this._policies.values()).sort((a, b) => {
            const order = (a.user + a.token.address).localeCompare(b.user + b.token.address);
            if (order === 0) {
                return a.token.id - b.token.id;
            }
            else {
                return order;
            }
        });
    }

    // Load policies from storage
    async load() {
        if (await existsFile(this._savePath)) {
            const policies = await readCsv(this._savePath);
            for (const policy of policies) {
                this.add(policy.user, new Token(policy.contract, policy.tokenId), ethers.utils.parseEther(policy.insurance));
            }
        }
        console.log('Loaded ' + this._policies.size + ' policies from storage');
    }

    async save() {
        let csv = 'user,contract,tokenId,insurance';
        for (const policy of this._policies.values()) {
            csv += '\n' + policy.user + ',' + policy.token.address + ',' + policy.token.id + ',' + ethers.utils.formatEther(policy.insurance);
        }
        await writeCsv(this._savePath, csv);
        console.log('Updated ' + this._policies.size + ' policies in storage');
    }

    clear() {
        this._policies.clear();
    }

    has(token) {
        if (!token) {
            throw new Error('Missing token');
        }
        return this._policies.has(token.uniqueId);
    }

    hasActive(token) {
        if (!token) {
            throw new Error('Missing token');
        }
        const policy = this._policies.get(token.uniqueId);
        return policy && policy.running;
    }

    start(token) {
        const policy = this.get(token);
        if (!policy.running) {
            policy.running = true;
            console.log('Started policy ' + token.uniqueId);
        }
    }

    stop(token) {
        const policy = this.get(token);
        if (policy.running) {
            policy.running = false;
            console.log('Stopped policy ' + token.uniqueId);
        }
    }

    get(token) {
        const policy = this._policies.get(token.uniqueId);
        if (!policy) {
            throw new Error('Policy ' + id + ' does not exist');
        }
        return policy;
    }

    getInsurance(tokens) {
        if (!Array.isArray(tokens)) {
            throw new Error('Missing token batch');
        }
        let insurance = ethers.BigNumber.from(0);
        for (const token of tokens) {
            const policy = this.get(token);
            insurance = insurance.add(policy.insurance);
        }
        return insurance;
    }

    getUser(token) {
        const policy = this.get(token);
        return policy.user;
    }

    add(user, token, insurance) {
        if (!user || !ethers.utils.isAddress(user)) {
            throw new Error('Missing or invalid user');
        }
        if (!token) {
            throw new Error('Missing token');
        }
        if (!insurance || !insurance._isBigNumber) {
            throw new Error('Missing or invalid insurance');
        }
        if (this._policies.has(token.uniqueId)) {
            const existing = this._policies.get(token.uniqueId);
            if (user.toLowerCase() !== existing.user) {
                throw new Error('Policy already registered to another user');
            }
        }
        this._policies.set(token.uniqueId, {
            user: user.toLowerCase(),
            token,
            insurance,
            running: true,
        });
        console.log('Updated policy ' + token.uniqueId + ' for user ' + user + ' with insurance ' + ethers.utils.formatEther(insurance));
    }

    remove(token) {
        if (this._policies.has(token.uniqueId)) {
            this._policies.delete(token.uniqueId);
            console.log('Removed policy ' + token.uniqueId);
        }
    }
}

module.exports = PolicyManager;