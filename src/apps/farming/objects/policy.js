const ethers = require('ethers');

class Policy {
    constructor(user, token) {
        if (!user || !ethers.utils.isAddress(user)) {
            throw new Error('Missing or invalid user');
        }
        if (!token) {
            throw new Error('Missing token');
        }
        this._user = user.toLowerCase();
        this._token = token;
        this._active = true;
    }

    get type() {
        return 'listing';
    }

    get active() {
        return this._active;
    }

    get type() {
        return 'generic';
    }

    get user() {
        return this._user;
    }

    get token() {
        return this._token;
    }

    start() {
        this._active = true;
    }

    stop() {
        this._active = false;
    }
}

module.exports = Policy;