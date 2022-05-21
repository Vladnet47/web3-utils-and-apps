
class PolicyManager {
    constructor(signerManager, savePath) {
        if (!signerManager) {
            throw new Error('Missing signer manager');
        }
        if (!savePath) {
            throw new Error('Missing save path');
        }
        this._sm = signerManager;
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

    async load() {
        throw new Error('Must be implemented by child');
    }

    async save() {
        throw new Error('Must be implemented by child');
    }

    clear() {
        this._policies.clear();
    }

    hasPolicy(token) {
        if (!token || !token.uniqueId) {
            throw new Error('Missing or invalid token');
        }
        return this._policies.has(token.uniqueId);
    }

    hasActivePolicy(token) {
        if (!token || !token.uniqueId) {
            throw new Error('Missing or invalid token');
        }
        const policy = this._policies.get(token.uniqueId);
        return policy && policy.active;
    }

    startPolicy(token) {
        const policy = this.getPolicy(token);
        if (!policy.active) {
            policy.start();
            console.log('Started ' + policy.type + ' policy ' + policy.token.uniqueId + ' for ' + policy.user);
        }
    }

    stopPolicy(token) {
        const policy = this.getPolicy(token);
        if (policy.active) {
            policy.stop();
            console.log('Stopped ' + policy.type + ' policy ' + policy.token.uniqueId + ' for ' + policy.user);
        }
    }

    // Returns user that has policy for given token
    getUser(token) {
        const policy = this.getPolicy(token);
        return policy.user;
    }

    // Returns policy for given token
    getPolicy(token) {
        if (!token || !token.uniqueId) {
            throw new Error('Missing token');
        }
        const policy = this._policies.get(token.uniqueId);
        if (!policy) {
            throw new Error('Policy ' + token.uniqueId + ' does not exist');
        }
        return policy;
    }

    async addPolicy(policy) {
        if (!policy || !policy.token) {
            throw new Error('Missing or invalid policy');
        }
        if (this._policies.has(policy.token.uniqueId)) {
            const existing = this._policies.get(policy.token.uniqueId);
            if (policy.user !== existing.user) {
                throw new Error('Policy already registered to another user');
            }
        }
        this._policies.set(policy.token.uniqueId, policy);
        console.log('Updated ' + policy.type + ' policy ' + policy.token.uniqueId + ' for user ' + policy.user);
    }

    removePolicy(token) {
        if (!token || !token.uniqueId) {
            throw new Error('Missing token');
        }
        if (this._policies.has(token.uniqueId)) {
            const policy = this.getPolicy(token);
            this._policies.delete(token.uniqueId);
            console.log('Removed ' + policy.type + ' policy ' + token.uniqueId);
        }
    }
}

module.exports = PolicyManager;