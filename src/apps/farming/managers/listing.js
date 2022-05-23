const { Mutex } = require('async-mutex');
const ethers = require('ethers');
const { ListingPolicy, Token } = require('../objects');
const { existsFile, readCsv, writeCsv } = require('../../../utils');
const PolicyManager = require('./policy');

const LISTING_RESET_MS = 20000;

// Manages running tasks for policies. Responsible for creating optimal transactions
// for cancelling token listings that someone is actively trying to purchase
class ListingPolicyManager extends PolicyManager {
    constructor(signerManager, savePath, looksRequests) {
        super(signerManager, savePath);
        if (!looksRequests) {
            throw new Error('Missing looks requests');
        }
        this._req = looksRequests;
        this._floorPriceMutex = new Mutex();
        this._floorPrice = new Map();

        this.syncFloorPrice = this.syncFloorPrice.bind(this);
    }

    async load() {
        if (await existsFile(this._savePath)) {
            const policies = await readCsv(this._savePath);
            for (const policy of policies) {
                await this.addPolicy(new ListingPolicy(policy.user, new Token(policy.contract, policy.tokenId), policy.percentage, policy.duration));
            }
        }
        console.log('Loaded ' + this._policies.size + ' listing policies from storage');
    }

    async save() {
        let csv = 'user,contract,tokenId,percentage,duration';
        for (const policy of this._policies.values()) {
            csv += '\n' + policy.user + ',' + policy.token.address + ',' + policy.token.id + ',' + policy.targetPercentage + ',' + policy.targetDuration;
        }
        await writeCsv(this._savePath, csv);
        console.log('Updated ' + this._policies.size + ' listing policies in storage');
    }
    
    async syncAllFloorPrices() {
        // Get unique collections
        const addresses = new Set();
        const tokens = [];
        for (const policy of this._policies.values()) {
            if (policy.active && !addresses.has(policy.token.address)) {
                addresses.add(policy.token.address);
                tokens.push(policy.token);
            }
        }

        // Get looks floor price of each collection from api
        console.log('Updating floor price for ' + tokens.length + ' collections');
        await Promise.all(tokens.map(t => this.syncFloorPrice(t)));
    }

    async syncFloorPrice(token) {
        if (!token) {
            throw new Error('Missing token');
        }
        const { floorPrice } = await this._req.getCollection(token.address);
        this._floorPrice.set(token.address, floorPrice);
        console.log('Updated floor price for ' + token.address + ' floor price: ' + ethers.utils.formatEther(floorPrice) + 'Ξ');
    }

    async syncAllListings() {
        const tasks = [];
        for (const listing of this._policies.values()) {
            if (listing.active) {
                tasks.push((async () => {
                    try {
                        await this.syncListing(listing.token);
                    }
                    catch (err) {
                        console.log('Failed to sync listing ' + listing.token.uniqueId + ': ' + err.message);
                    }
                })());
            }
        }
        await Promise.all(tasks);
    }

    async syncListing(token) {
        if (!this.hasActivePolicy(token)) {
            throw new Error('Listing is not active');
        }
        const listing = this.getPolicy(token);
        if (listing.remainingTime < LISTING_RESET_MS) {
            const price = this._nextPrice(listing);
            const nonce = listing.nonce == null || price.gt(listing.price) ? await this._req.getNonce(listing.user) : listing.nonce;
            const signer = this._sm.getSigner(listing.user);
            await this._req.createListing(signer, listing.token, price, nonce, listing.targetDuration);
            listing.nonce = nonce;
            listing.price = price;
            listing.startTime = new Date();
            console.log('Created listing for ' + listing.token.uniqueId + ' at ' + ethers.utils.formatEther(price) + 'Ξ (' + nonce + ') for ' + listing.targetDuration + 'ms');
        }
    }

    // Calculate target price
    _nextPrice(listing) {
        const floorPrice = this._floorPrice.get(listing.token.address);
        if (!floorPrice) {
            throw new Error('Missing floor price for ' + listing.token.address);
        }
        const newPrice = floorPrice.mul(listing.targetPercentage + 100).div(100);
        return listing.price && newPrice.eq(listing.price) ? newPrice.add(ethers.utils.parseEther('0.0001')) : newPrice; // Price must differ from previous
    }

    async addPolicy(policy) {
        // Update floor price if necessary
        const release = await this._floorPriceMutex.acquire();
        try {
            if (!this._floorPrice.has(policy.token.address)) {
                await this.syncFloorPrice(policy.token);
            }
        }
        catch (err) {
            throw new Error('Failed to sync floor price: ' + err.message);
        }
        finally {
            release();
        }
        await super.addPolicy(policy);
        policy.start();
    }
}

module.exports = ListingPolicyManager;