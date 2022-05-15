const { isNumeric } = require('../../utils');
const ethers = require('ethers');

class Token {
    constructor(address, id) {
        if (!address || !ethers.utils.isAddress(address)) {
            throw new Error('Missing or invalid token address');
        }
        if (id == null || !isNumeric(id)) {
            throw new Error('Missing or invalid token id');
        }
        this._address = address.toLowerCase();
        this._tokenId = id.toString();
    }

    get uniqueId() {
        return this._address + '_' + this._tokenId;
    }

    get address() {
        return this._address;
    }

    get id() {
        return this._tokenId;
    }

    isFrom(address) {
        if (!address) {
            throw new Error('Missing address');
        }
        return this._address === address.toLowerCase();
    }

    isSame(token) {
        if (!token) {
            throw new Error('Missing token');
        }
        return this.uniqueId === token.uniqueId;
    }
}

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

    isToken(token) {
        if (!token) {
            throw new Error('Missing token');
        }
        return this._token.isSame(token);
    }
}

module.exports = {
    Token,
    Listing,
};

