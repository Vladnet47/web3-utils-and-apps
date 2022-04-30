const ethers = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

class BundleManager {
    constructor(provider, address, mintFnAbi) {
        if (!provider) {
            throw new Error('Missing web3 provider');
        }
        if (!address) {
            throw new Error('Missing contract address');
        }
        this._address = address;
        this._mintFnAbi = mintFnAbi;
        this._prov = provider;
        this._bundles = [];
        this._signedBundles = [];
        this._flashbotsKey;
        this._signedBundle; // Bundle that groups all tasks together
    }

    async addBundle(bundle = {}) {
        if (!bundle) {
            throw new Error('Missing bundle');
        }
        const { flashbotsKey } = bundle;
        if (!flashbotsKey) {
            throw new Error('Bundle missing flashbots key');
        }

        const fbProvider = await FlashbotsBundleProvider.create(this._prov, new ethers.Wallet(flashbotsKey));
        const formatted = this._createBundle(bundle);
        const signed = await fbProvider.signBundle(formatted);
        this._bundles.push({
            fbProvider,
            bundle: signed 
        });
    }

    _createBundle(bundle = {}) {
        if (!bundle) {
            throw new Error('Missing bundle');
        }
        const { mainKey, kycKey, count, maxFee, gasLimit, params, data } = bundle;
        if (!mainKey) {
            throw new Error('Bundle missing main key');
        }
        if (!kycKey) {
            throw new Error('Bundle missing kyc key');
        }
        if (count === 0 || count > 2) {
            throw new Error('Count must be between 1 and 2');
        }
        if (!maxFee) {
            throw new Error('Missing max fee');
        }
        if (!gasLimit) {
            throw new Error('Missing gas limit');
        }

        const maxFeePerGas = ethers.utils.parseUnits(maxFee, 'gwei');
        const mintFees = maxFeePerGas.mul(gasLimit);

        const mainSig = new ethers.Wallet(mainKey, this._prov);
        const [mainNonce, mainBalance] = await Promise.all([mainSig.getTransactionCount(), mainSig.getBalance()]);

        const kycSig = new ethers.Wallet(kycKey, this._prov);
        const [kycNonce, kycBalance] = await Promise.all([kycSig.getTransactionCount(), kycSig.getBalance()]);

        return [
            {
                // Send APE from main wallet to target
                signer: mainSig,
                tx: {
                    to: kycSig.address,
                    maxFeePerGas,
                    maxPriorityFeePerGas: maxFeePerGas,
                    gasLimit: 21000,
                    value: mintFees, // Transfer enough fees for mint and transfer back
                    type: 2,
                    data: '0x',
                    chainId: 1,
                    nonce: mainNonce,
                },
            },
            {
                // Mint LAND nft with APE from target
                signer: kycSig,
                tx: {
                    to: this._address,
                    maxFeePerGas,
                    maxPriorityFeePerGas: maxFeePerGas,
                    gasLimit,
                    value: ethers.BigNumber.from(0),
                    type: 2,
                    data: this._encodeTxData(params, data),
                    chainId: 1,
                    nonce: kycNonce,
                }
            },
            {
                // Move LAND nft to main wallet
                signer: kycSig,
                tx: {
                    to: kycSig.address,
                    maxFeePerGas,
                    maxPriorityFeePerGas: maxFeePerGas,
                    gasLimit: 21000,
                    value: ethers.BigNumber.from(0),
                    type: 2,
                    data: '0x',
                    chainId: 1,
                    nonce: kycNonce + 1,
                },
            }
        ];
    }

    _encodeTxData(params = [], data) {
        if (!Array.isArray(params)) {
            throw new Error('Params must be array');
        }
        if (this._mintFnAbi) {
            const iface = new ethers.utils.Interface(this._mintFnAbi);
            const frags = iface.fragments;
            const sig = frags[0].format(ethers.utils.FormatTypes.sighash);
            try {
                return iface.encodeFunctionData(sig, params);
            }
            catch (err) {
                throw new Error('Invalid parameters for contract function call: ' + err.message);
            }
        }
        else {
            if (!data) {
                throw new Error('Missing both mint fn abi and data');
            }
            return data;
        }
    }

    async send(tbn, debug) {
        if (!tbn) {
            throw new Error('Missing target block');
        }

        const sendOne = async b => {
            const { fbProvider, bundle } = b;
            if (debug === true) {
                const res = await this._simulateBundle(fbProvider, bundle, tbn);
                if (res.success) {
                    console.log('Successfully included bundle ' + res.bundleHash + '!');
                }
                else {
                    console.log('Failed to include bundle ' + res.bundleHash + ': ' + res.error);
                }
            }
            else {
                const res = await this._sendBundle(fbProvider, bundle, tbn);
                if (res.success) {
                    console.log('Successfully included bundle ' + res.bundleHash + '!');
                }
                else {
                    console.log('Failed to include bundle ' + res.bundleHash + ': ' + res.error);
                }
            }   
        }

        console.log('Sending bundles for block ' + tbn + '...');
        await Promise.all(this._bundles.map(sendOne));
    }

    async _sendBundle(fb, signedBundle, tbn) {
        if (!fb || !signedBundle || !tbn) {
            throw new Error('Missing required params');
        }
    
        const bundleReceipt = await fb.sendRawBundle(signedBundle, tbn);
        await bundleReceipt.wait();
    
        // Get error/success message
        const simulation = await bundleReceipt.simulate();
        const bundleHash = simulation.bundleHash;
        if (simulation.error || simulation.firstRevert && simulation.firstRevert.error) {
            return { status: false, error: simulation.firstRevert.error || simulation.error, bundleHash };
        }
        else {
            return { status: true, bundleHash };
        }
    }
    
    async _simulateBundle(fb, signedBundle, tbn) {
        if (!fb || !signedBundle || !tbn) {
            throw new Error('Missing required params');
        }

        const simulation = await fb.simulate(signedBundle, tbn);
        if (simulation.error || simulation.firstRevert && simulation.firstRevert.error) {
            return { status: false, error: simulation.firstRevert.error || simulation.error, bundleHash };
        } 
        else {
            return { status: true, bundleHash };
        }
    }
}

module.exports = BundleManager;