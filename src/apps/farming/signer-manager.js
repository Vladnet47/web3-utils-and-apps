const ethers = require('ethers');
const { readConfigs } = require('../../utils');

class SignerManager {
    constructor(provider) {
        if (!provider) {
            throw new Error('Missing provider');
        }
        this._prov = provider;
        this._signersByName = new Map();
        this._signersByAddress = new Map();
    }

    get names() {
        return Array.from(this._signersByName.keys()).sort((a, b) => a.localeCompare(b));
    }

    get addresses() {
        return Array.from(this._signersByAddress.keys()).sort((a, b) => a.localeCompare(b));
    }

    // Load signer private keys from configs
    async load() {
        const { privateKeys } = await readConfigs();
        for (const [name, pk] of Object.entries(privateKeys)) {
            this.add(name, pk);
        }
        console.log('Loaded ' + this._signersByName.size + ' signers from configs');
    }

    getAddress(name) {
        if (!name) {
            throw new Error('Missing name');
        }
        const signer = this._signersByName.get(name.toLowerCase());
        if (!signer) {
            throw new Error('Signer ' + name + ' does not exist');
        }
        return signer.address.toLowerCase();
    }

    get(address) {
        if (!address || !ethers.utils.isAddress(address)) {
            throw new Error('Missing or invalid address');
        }
        const signer = this._signersByAddress.get(address.toLowerCase());
        if (!signer) {
            throw new Error('Signer ' + address + ' does not exist');
        }
        return signer;
    }

    add(name, privateKey) {
        if (!name) {
            throw new Error('Missing name');
        }
        if (!privateKey) {
            throw new Error('Missing private key');
        }
        if (this._signersByName.has(name.toLowerCase())) {
            throw new Error('Signer ' + name + ' already exists');
        }
        const signer = new ethers.Wallet(privateKey, this._prov);
        this._signersByAddress.set(signer.address.toLowerCase(), signer);
        this._signersByName.set(name.toLowerCase(), signer);
        console.log('Added signer ' + name + ' (' + signer.address + ')');
    }
}

module.exports = SignerManager;