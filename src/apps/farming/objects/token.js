const ethers = require('ethers');
const { isNumeric } = require('../../../utils');

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
}

module.exports = Token;