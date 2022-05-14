const ethers = require('ethers');
const { isNumeric, readCsv, writeCsv, existsFile } = require('../../utils');

class PolicyManager {
    constructor(savePath) {
        if (!savePath) {
            throw new Error('Missing save path');
        }
        this._savePath = savePath;
        this._policies = new Map();
    }

    get policies() {
        return Array.from(this._policies.values());
    }

    // Load policies from storage
    async load() {
        if (await existsFile(this._savePath)) {
            const policies = await readCsv(this._savePath);
            for (const policy of policies) {
                this.add(policy.user, policy.contract, policy.tokenId, ethers.utils.parseEther(policy.insurance));
            }
        }
        console.log('Loaded ' + this._policies.size + ' policies from storage');
    }

    async save() {
        let csv = 'user,contract,tokenId,insurance';
        for (const policy of this._policies.values()) {
            csv += '\n' + policy.user + ',' + policy.contract + ',' + policy.tokenId + ',' + ethers.utils.formatEther(policy.insurance);
        }
        await writeCsv(this._savePath, csv);
        console.log('Updated ' + this._policies.size + ' policies in storage');
    }

    has(user, contract, tokenId) {
        const id = this._getId(user, contract, tokenId);
        return this._policies.has(id);
    }

    hasActive(user, contract, tokenId) {
        const id = this._getId(user, contract, tokenId);
        const policy = this._policies.get(id);
        return policy && policy.running;
    }

    start(user, contract, tokenId) {
        const policy = this.get(user, contract, tokenId);
        if (!policy.running) {
            policy.running = true;
            console.log('Started policy ' + policy.id);
        }
    }

    stop(user, contract, tokenId) {
        const policy = this.get(user, contract, tokenId);
        if (policy.running) {
            policy.running = false;
            console.log('Stopped policy ' + policy.id);
        }
    }

    get(user, contract, tokenId) {
        const id = this._getId(user, contract, tokenId);
        const policy = this._policies.get(id);
        if (!policy) {
            throw new Error('Policy ' + id + ' does not exist');
        }
        return policy;
    }

    add(user, contract, tokenId, insurance) {
        if (!insurance || !insurance._isBigNumber) {
            throw new Error('Missing or invalid insurance');
        }
        const id = this._getId(user, contract, tokenId);
        this._policies.set(id, {
            id,
            user: user.toLowerCase(),
            contract: contract.toLowerCase(),
            tokenId,
            insurance,
            running: true,
        });
        console.log('Updated policy ' + id + ' with insurance ' + ethers.utils.formatEther(insurance));
    }

    remove(user, contract, tokenId) {
        const id = this._getId(user, contract, tokenId);
        if (this._policies.has(id)) {
            this._policies.delete(id);
        }
        console.log('Removed policy ' + id);
    }

    _getId(user, contract, tokenId) {
        if (!user || !ethers.utils.isAddress(user)) {
            throw new Error('Missing or invalid user');
        }
        if (!contract || !ethers.utils.isAddress(user)) {
            throw new Error('Missing or invalid token contract');
        }
        if (tokenId == null || !isNumeric(tokenId)) {
            throw new Error('Missing or invalid token id');
        }
        return user.toLowerCase() + '_' + contract.toLowerCase() + '_' + tokenId;
    }
}

module.exports = PolicyManager;