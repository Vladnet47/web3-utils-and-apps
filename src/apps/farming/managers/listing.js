const ethers = require('ethers');
const PolicyManager = require('./policy');

// Manages running tasks for policies. Responsible for creating optimal transactions
// for cancelling token listings that someone is actively trying to purchase
class ListingPolicyManager extends PolicyManager {
    constructor(signerManager, savePath, looksRequests) {
        super(signerManager, savePath);
        if (!looksRequests) {
            throw new Error('Missing looks requests');
        }
        this._req = looksRequests;
        this._floorPrice = new Map();
    }

    async checkFloorPrice() {
        try {
            // Get unique collections
            const cols = new Set();
            for (const policy of this._policies.values()) {
                if (policy.active && !cols.has(policy.token.address)) {
                    cols.add(policy.token.address);
                }
            }

            // Get looks floor price of each collection from api
            const colAddr = Array.from(cols.values());
            const colInfo = await Promise.all(colAddr.map(a => this._req.getCollection(a)));

            console.log('Updated floor price for ' + colAddr.length + ' collections');
            this._floorPrice.clear();
            for (let i = 0; i < colAddr.length; ++i) {
                this._floorPrice.set(colAddr[i], colInfo[i].floorPrice);
                console.log(colAddr[i] + ': ' + ethers.utils.formatEther(colInfo[i].floorPrice + 'Ξ'));
            }
        }
        catch (err) {
            console.log('Failed to check floor price of one or more collections: ' + err.message);
        }
    }

    async checkListings() {
        
    }
}

module.exports = ListingPolicyManager;