const ethers = require('ethers');
const PolicyManager = require('./policy');
const { Token } = require('../objects');
const { existsFile, readCsv, writeCsv, calcPrioFee, getFrontrunFee } = require('../../../utils');

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a'.toLowerCase();
const LOOKS_IFACE = new ethers.utils.Interface(['function cancelMultipleMakerOrders(uint256[] orderNonces) payable returns()']);
const BASE_GAS_LIMIT = 70000;
const PER_GAS_LIMIT = 25000;

class CancelPolicyManager extends PolicyManager {
    constructor(signerManager, savePath) {
        super(signerManager, savePath);
        this._requests = new Map();
    }

    async load() {
        if (await existsFile(this._savePath)) {
            const policies = await readCsv(this._savePath);
            for (const policy of policies) {
                if (!policy.insurance) {
                    throw new Error('Policy missing insurance');
                }
                this.addPolicy(policy.user, new Token(policy.contract, policy.tokenId), ethers.utils.parseEther(policy.insurance));
            }
        }
        console.log('Loaded ' + this._policies.size + ' cancel policies from storage');
    }

    async save() {
        let csv = 'user,contract,tokenId,insurance';
        for (const policy of this._policies.values()) {
            csv += '\n' + policy.user + ',' + policy.token.address + ',' + policy.token.id + ',' + ethers.utils.formatEther(policy.insurance);
        }
        await writeCsv(this._savePath, csv);
        console.log('Updated ' + this._policies.size + ' cancel policies in storage');
    }

    getInsurance(tokens) {
        if (!Array.isArray(tokens)) {
            throw new Error('Missing token batch');
        }
        let insurance = ethers.BigNumber.from(0);
        for (const token of tokens) {
            const policy = this.getPolicy(token);
            if (!policy.insurance) {
                throw new Error('Policy missing insurance');
            }
            insurance = insurance.add(policy.insurance);
        }
        return insurance;
    }

    // Adds request for frontrunning a sale with cancel transaction
    addRequest(listing, baseFee, maxFee, prioFee) {
        if (!listing || !this.hasActivePolicy(listing.token)) {
            throw new Error('No active policy exists for token');
        }
        if (!baseFee || !baseFee._isBigNumber) {
            throw new Error('Missing or invalid base fee');
        }

        const updateReq = () => {
            this._requests.set(listing.token.uniqueId, { listing, maxFee, prioFee });
            console.log('Updated cancel request ' + listing.token.uniqueId);
        }

        // Add or replace existing request if new prio fee is greater
        const existing = this._requests.get(listing.token.uniqueId);
        if (existing) {
            const newPrio = calcPrioFee(baseFee, maxFee, prioFee);
            const existingPrio = calcPrioFee(baseFee, existing.maxFee, existing.prioFee);
            if (newPrio.gt(existingPrio)) {
                updateReq();
            }
        }
        else {
            updateReq();
        }
    }

    // Removes request from batch
    removeRequest(token) {
        if (this._requests.has(token.uniqueId)) {
            this._requests.remove(token.uniqueId);
            console.log('Removed cancel request ' + token.uniqueId);
        }
    }

    // Returns list of cancel txs to submit with their signers
    getRequestTxs(baseFee) {
        if (!baseFee || !baseFee._isBigNumber) {
            throw new Error('Missing or invalid base fee');
        }
        if (this._requests.size === 0) {
            return [];
        }

        // Group requests by user
        const userRequests = new Map();
        for (const request of this._requests.values()) {
            const user = this.getPolicy(request.listing.token).user;
            if (userRequests.has(user)) {
                userRequests.get(user).push(request);
            }
            else {
                userRequests.set(user, [request]);
            }
        }

        // Create bundle of cancel transactions, one group of cancels for each user
        const bundle = [];
        for (const [user, requests] of userRequests.entries()) {
            const listingNonces = [];
            const listings = [];
            for (const r of requests) {
                listingNonces.push(r.listing.nonce);
                listings.push(r.listing);
            }

            const nonce = this._sm.getNonce(user);
            if (nonce == null) {
                throw new Error('Missing nonce for ' + user);
            }

            // Get max prio fee of batch and use that as frontrunning fee
            const prioFee = this._getMaxPrioBatch(requests, baseFee);
            const maxFee = baseFee.add(prioFee).mul(4).div(3); // 1.33x buffer
            const frFees = getFrontrunFee(maxFee, prioFee);

            // Construct cancel tx with all listing nonces
            const transaction = {
                to: LOOKS_ADDRESS,
                maxFeePerGas: frFees.maxFee,
                maxPriorityFeePerGas: frFees.prioFee,
                gasLimit: BASE_GAS_LIMIT + PER_GAS_LIMIT * listingNonces.length,
                value: ethers.BigNumber.from(0),
                type: 2,
                data: LOOKS_IFACE.encodeFunctionData('cancelMultipleMakerOrders', [listingNonces]),
                chainId: 1,
                nonce,
            };

            bundle.push({ user, listings, transaction });
        }

        return bundle;
    }

    // Identify highest prio fee for requests in batch
    _getMaxPrioBatch(requests, baseFee) {
        let prioFee = ethers.BigNumber.from(0);
        for (const req of requests) {
            const tempPrioFee = calcPrioFee(baseFee, req.maxFee, req.prioFee);
            if (tempPrioFee.gt(prioFee)) {
                prioFee = tempPrioFee;
            }
        }
        return prioFee;
    }
}

module.exports = CancelPolicyManager;