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

class CancelPolicy extends Policy {
    constructor(user, token, insurance) {
        super(user, token);
        if (!insurance || !insurance._isBigNumber) {
            throw new Error('Missing or invalid insurance');
        }
        this._insurance = insurance;
    }

    get type() {
        return 'cancel';
    }

    get insurance() {
        return this._insurance;
    }
}

class ListingPolicy extends Policy {
    constructor(user, token, frequency) {
        super(user, token);
        if (!frequency || frequency < 1) {
            throw new Error('Missing or invalid listing frequency');
        }
        this._frequency = frequency;
    }

    get type() {
        return 'listing';
    }

    get frequency() {
        return this._frequency;
    }
}

module.exports = {
    Policy,
    CancelPolicy,
    ListingPolicy,
};