const ethers = require('ethers');
const { readConfigs, getAddressDetails } = require('../../utils');

class SignerManager {
    constructor(provider) {
        if (!provider) {
            throw new Error('Missing provider');
        }
        this._prov = provider;
        this._addresses = new Map(); // name -> address
        this._signers = new Map();
    }

    get names() {
        return Array.from(this._addresses.keys()).sort((a, b) => a.localeCompare(b));
    }

    get addresses() {
        return Array.from(this._addresses.values()).sort((a, b) => a.localeCompare(b));
    }

    // Load signer private keys from configs
    async load() {
        const { privateKeys } = await readConfigs();
        for (const [name, pk] of Object.entries(privateKeys)) {
            this.add(name, pk);
        }
        console.log('Loaded ' + this._signers.size + ' signers from configs');
        await this.sync();
    }

    // Update signer nonces and balances
    async sync() {
        await Promise.all(Array.from(this._signers.values()).map(s => (async () => {
            const { nonce, balance } = await getAddressDetails(s.signer.provider, s.signer.address);
            s.nonce = nonce;
            s.balance = balance;
        })()));
        console.log('Synced signer nonces and balances:');
        for (const details of this._signers.values()) {
            console.log(details.signer.address + ' (non=' + details.nonce + ') (bal=' + ethers.utils.formatEther(details.balance) + 'Ξ)');
        }
    }

    getName(address) {
        if (!address || !ethers.utils.isAddress(address)) {
            throw new Error('Missing address');
        }
        address = address.toLowerCase();
        let name;
        for (const [name, addr] of this._addresses.entries()) {
            if (addr === address) {
                return name;
            }
        }
        if (!name) {
            throw new Error('User does not exist');
        }
        return name;
    }

    getAddress(name) {
        if (!name) {
            throw new Error('Missing name');
        }
        const address = this._addresses.get(name.toLowerCase());
        if (!address) {
            throw new Error('Signer ' + name + ' does not exist');
        }
        return address;
    }

    getSigner(address) {
        return this._getDetails(address).signer;
    }

    getNonce(address) {
        return this._getDetails(address).nonce;
    }

    getBalance(address) {
        return this._getDetails(address).balance;
    }

    add(name, privateKey) {
        if (!name) {
            throw new Error('Missing name');
        }
        if (!privateKey) {
            throw new Error('Missing private key');
        }
        name = name.toLowerCase();
        if (this._addresses.has(name)) {
            throw new Error('Signer ' + name + ' already exists');
        }
        const signer = new ethers.Wallet(privateKey, this._prov);
        const address = signer.address.toLowerCase();
        this._addresses.set(name, address);
        this._signers.set(address, { signer, nonce: null, balance: null });
        console.log('Added signer ' + name + ' (' + signer.address + ')');
    }

    _getDetails(address) {
        if (!address || !ethers.utils.isAddress(address)) {
            throw new Error('Missing or invalid address');
        }
        const details = this._signers.get(address.toLowerCase());
        if (!details) {
            throw new Error('Signer ' + address + ' does not exist');
        }
        return details;
    }
}

module.exports = SignerManager;