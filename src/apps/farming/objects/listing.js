const Policy = require('./policy');

const LISTING_DURATION = 30; // minutes

// Used to track active listings and when they expire.
class ListingPolicy extends Policy {
    constructor(user, token, signer, looksRequests, targetPercentage) {
        super(user, token);
        if (!signer) {
            throw new Error('Missing signer');
        }
        if (!looksRequests) {
            throw new Error('Missing looksrare requests');
        }
        if (targetPercentage == null || targetPercentage < 0) {
            throw new Error('Missing or invalid target percentage');
        }
        this._signer = signer;
        this._req = looksRequests;
        this._tp = targetPercentage;

        this._nonce;
        this._price;
        this._endTime;
        this._floorPrice;

        this._timer;
    }

    get type() {
        return 'listing';
    }

    get active() {
        return this._timer != null;
    }

    get targetPerc() {
        return this._tp;
    }

    get nonce() {
        return this._nonce;
    }

    get remainingTime() {
        return this._endTime != null ? this._endTime - new Date() : 0;
    }

    get price() {
        return this._price;
    }

    get floorPrice() {
        return this._floorPrice;
    }

    set floorPrice(value) {
        if (!value || !value._isBigNumber) {
            throw new Error('Missing or invalid floor price');
        }
        this._floorPrice = value;
    } 

    // Starts timer and notifies callback once it elapses
    start() {
        if (!endTime) {
            throw new Error('Missing end time');
        }
        if (!cb) {
            throw new Error('Missing callback');
        }
        if (nonce == null || nonce < 0) {
            throw new Error('Missing or invalid listing nonce');
        }
        if (this._timer) {
            throw new Error('Listing already active');
        }
        const duration = endTime - new Date();
        if (duration < 0) {
            throw new Error('Duration is invalid');
        }
        this._nonce = nonce;
        this._timer = setTimeout(() => {
            this.stop();
            cb();
        }, duration);
    }

    async list() {
        if (this._timer) {

        }
        else {
            // Check if manually listed
            const listed = false;
            if (listed) {
                // Don't do anything, just check again after some time
            }
            else {
                // Get next price and nonce
                

                this._timer = setTimeout(this.list, this.remainingTime + 1000);
                console.log('Created new ' + Math.round(this.remainingTime / 1000 / 60) + 'm listing for ' + this._token.uniqueId);
            }
        }
    }

    async createNewListing(price, duration) {
        if (!price || !price._isBigNumber) {
            throw new Error('Missing or invalid price');
        }
        if (duration == null || duration < 60 * 1000) {
            throw new Error('Missing or invalid duration');
        }
        const nonce = await this._req.getNonce(this._user);
        const { endTime } = await this._req.createListing(this._signer, this._token, price, nonce, duration);
        this._endTime = endTime;
        this._price = price;
        this._nonce = nonce;
    }

    // Return next price
    nextPrice() {
        if (!this._floorPrice) {
            throw new Error('Floor price not set');
        }
        return this._floorPrice.mul(targetPercentage + 100).div(100);
    }

    stop() {
        if (this._timer) {
            const timer = this._timer;
            this._timer = null;
            this._price = null;
            this._nonce = null;
            this._endTime = null;
            clearTimeout(timer);
        }
    }
}

module.exports = ListingPolicy;