const Policy = require('./policy');

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

module.exports = CancelPolicy;