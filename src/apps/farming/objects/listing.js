const Policy = require('./policy');

const MIN_DURATION = 60 * 1000; // 1 minute
const EARLY_NOTIF = 30 * 1000; // Notify about listing ending 30 seconds before it does

// Used to track active listings and when they expire.
class ListingPolicy extends Policy {
    constructor(user, token, targetPercentage, targetDuration) {
        super(user, token);
        if (targetPercentage == null || targetPercentage < 0) {
            throw new Error('Missing or invalid target percentage');
        }
        if (targetDuration == null || targetDuration < MIN_DURATION) {
            throw new Error('Missing or invalid target duration (at least ' + MIN_DURATION + 'ms)');
        }
        this._tp = Math.round(targetPercentage);
        this._td = Math.round(targetDuration);
        this._nonce;
        this._price;
        this._startTime;
        this._timer;
    }

    get type() {
        return 'listing';
    }

    get active() {
        return this._active = true;
    }

    get targetPercentage() {
        return this._tp;
    }

    get targetDuration() {
        return this._td;
    }

    get nonce() {
        return this._nonce;
    }

    set nonce(value) {
        if (value == null || value < 0) {
            throw new Error('Missing or invalid nonce');
        }
        this._nonce = value;
    }

    get remainingTime() {
        return this._startTime != null ? Math.max(this._td - (new Date() - this._startTime), 0) : 0;
    }

    set startTime(value) {
        if (!value) {
            throw new Error('Missing start time');
        }
        this._startTime = value;
    }

    get price() {
        return this._price;
    }

    set price(value) {
        if (!value || !value._isBigNumber) {
            throw new Error('Missing or invalid price');
        }
        this._price = value;
    }
}

module.exports = ListingPolicy;