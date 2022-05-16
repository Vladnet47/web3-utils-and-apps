
class Listing {
    constructor(token, listingNonce) {
        if (!token) {
            throw new Error('Missing token');
        }
        if (listingNonce == null) {
            throw new Error('Missing listing nonce')
        }
        this._token = token;
        this._nonce = listingNonce.toString();
    }

    get token() {
        return this._token;
    }

    get nonce() {
        return this._nonce;
    }
}

module.exports = Listing;