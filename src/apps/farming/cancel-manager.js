const { ethers } = require('ethers');
const { getFrontrunFee, getBaseFee, calcPrioFee } = require('../../utils');

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a'.toLowerCase();
const LOOKS_IFACE = new ethers.utils.Interface(['function cancelMultipleMakerOrders(uint256[] orderNonces) payable returns()']);
const BASE_GAS_LIMIT = 60000;
const PER_GAS_LIMIT = 10000;

// Manages running tasks for policies. Responsible for creating optimal transactions
// for cancelling token listings that someone is actively trying to purchase
class CancelManager {
    constructor(signerManager) {
        if (!signerManager) {
            throw new Error('Missing signer manager');
        }
        this._sm = signerManager;
        this._requests = new Map();
    }

    // Adds request for frontrunning a purchase tx for token with policy
    add(user, listing, baseFee, maxFee, prioFee) {
        if (!user || !ethers.utils.isAddress(user)) {
            throw new Error('Missing or invalid user');
        }
        if (!listing) {
            throw new Error('Missing listing');
        }
        if (!baseFee || !baseFee._isBigNumber) {
            throw new Error('Missing or invalid base fee');
        }

        const updateReq = () => {
            this._requests.set(listing.token.id, { user: user.toLowerCase(), listing, maxFee, prioFee });
            console.log('Update cancel request ' + listing.token.id);
        }

        // Add or replace existing request if new prio fee is greater
        const existing = this._requests.get(listing.token.id);
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
    remove(token) {
        if (this._requests.has(token.id)) {
            this._requests.remove(token.id);
            console.log('Removed cancel request ' + token.id);
        }
    }

    // Returns list of cancel txs to submit with their signers
    getTxs(baseFee) {
        if (!baseFee || !baseFee._isBigNumber) {
            throw new Error('Missing or invalid base fee');
        }
        if (this._requests.size === 0) {
            return [];
        }

        // Group requests by user
        const userRequests = new Map();
        for (const request of this._requests.values()) {
            if (userRequests.has(request.user)) {
                userRequests.get(request.user).push(request);
            }
            else {
                userRequests.set(request.user, [request]);
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
    _getMaxPrioBatch(batch, baseFee) {
        if (!Array.isArray(batch) || batch.length === 0) {
            throw new Error('Invalid request batch');
        }
        if (!baseFee || !baseFee._isBigNumber) {
            throw new Error('Missing or invalid base fee');
        }
        let prioFee = ethers.BigNumber.from(0);
        for (const req of batch) {
            const tempPrioFee = calcPrioFee(baseFee, req.maxFee, req.prioFee);
            if (tempPrioFee.gt(prioFee)) {
                prioFee = tempPrioFee;
            }
        }
        return prioFee;
    }
}

module.exports = CancelManager;