const ethers = require('ethers');
const { getContractAbi, getAlchemyHttpProv } = require('../common');
const { isNumeric } = require('../../common');
const { readConfigs } = require('../../file');

const BLACKLIST = ['presale', 'whitelist', 'batch', 'allowlist', 'reserve', 'admin', 'free', 'dev'];
const SCAN_CONFIGS = [
    { 
        category: 'price',
        isReadonly: true,
        knownFns: [
            'PRICE() view returns(uint256)',
            'price() view returns(uint256)',
            'mintPrice() view returns(uint256)',
            'getPrice() view returns(uint256)',
            'cost() view returns(uint256)',
            'MINT_PRICE() view returns(uint256)',
            'TOKEN_PRICE() view returns(uint256)',
        ],
        isMatch: ({ fnSig, value }) => kwMatches(fnSig, ['price', 'cost']) && value && isNumeric(value),
        getResult: ({ fnSig, value }) => ({ 
            name: fnSig, 
            value: value._isBigNumber ? ethers.utils.formatEther(value) : value 
        })
    },
    {
        category: 'name',
        isReadonly: true,
        knownFns: [
            'name() view returns(string)'
        ],
        isMatch: ({ fnSig }) => kwMatches(fnSig, ['name']),
    },
    {
        category: 'owner',
        isReadonly: true,
        knownFns: [
            'owner() view returns(address)'
        ],
        isMatch: ({ fnSig, value }) => kwMatches(fnSig, ['owner']) && value && ethers.utils.isAddress(value.toString()),
    },
    {
        category: 'maxPer',
        isReadonly: true,
        knownFns: [
            'MAX_PURCHASE() view returns(uint256)',
            'MAX_PER_TX() view returns(uint256)',
            'maxMintAmount() view returns(uint256)',
            'maxMintsPerTx() view returns(uint256)',
        ],
        isMatch: ({ fnSig, value }) => kwMatches(fnSig, ['max', '-supply']) && value && isNumeric(value) && parseFloat(value) <= 100,
        getResult: ({ fnSig, value }) => ({ name: fnSig, value: parseInt(value) })
    },
    {
        category: 'priceUpdateFn',
        knownFns: [
            'setPrice(uint256)',
            'setCost(uint256)',
            'setMintPrice(uint256)',
            'changePrice(uint256)',
        ],
        isMatch: ({ fnSig }) => kwMatches(fnSig, ['price', 'cost']),
    },
    {
        category: 'unpauseFn',
        knownFns: [
            'unpause()',
        ],
        isMatch: ({ fnSig }) => kwMatches(fnSig, ['unpause']),
    },
    {
        category: 'pauseFn',
        knownFns: [
            'pause()',
            'pause(bool)',
            'pauseSale()',
            'setPaused(bool)',
            'pausePublicSale()',
        ],
        isMatch: ({ fnSig }) => kwMatches(fnSig, ['pause', 'end', 'stop']),
    },
    {
        category: 'mintFn', 
        knownFns: [
            'mint()',
            'mint(address)',
            'mint(uint256)',
            'mint(address,uint256)',
            'mint(uint256,bytes)',
            'mint(address,uint256,bytes)',
            'purchase(uint256)',
            'publicMint(uint256)',
            'mintToken(uint256)',
            'buy(uint256)',
            'mintNFT(uint256)',
        ],
        isMatch: ({ fnSig }) => kwMatches(fnSig, ['mint', 'buy', 'purchase', '-set', '-minter', '-owner', '-flip', '-start', '-toggle']),
    },
    {
        category: 'ownerUpdateFn',
        knownFns: [
            'transferOwnership(address)',
        ],
        isMatch: ({ fnSig }) => kwMatches(fnSig, ['owner', '-renounce', '-withdraw']),
    },
    {
        category: 'flipFn',
        knownFns: [
            'flipSaleState()',
            'startSale()',
            'toggleSale()',
            'toggleSaleStatus()',
            'setSaleState(bool)',
            'setSaleActive(bool)',
            'flipPublicSaleState()',
        ],
        isMatch: ({ fnSig }) => kwMatches(fnSig, ['flip', 'sale', 'live', 'start', 'toggle', '-date', '-index']),
    },
];

const UNVERIFIED_ABI = (() => {
    const abi = [];
    for (const config of SCAN_CONFIGS) {
        for (const fn of (config.knownFns || [])) {
            if (!fn) {
                throw new Error('Function is undefined');
            }
            if (config.isReadonly) {
                if (!fn.includes('view') || !fn.includes('returns')) {
                    throw new Error('Readonly fn ' + fn + ' missing view and returns() statements');
                }
            }
            abi.push('function ' + fn);
        }
    }
    return abi;
})();

async function scanFns(address, chainId) {
    if (!ethers.utils.isAddress(address)) {
        throw new Error('Missing address');
    }

    const { etherscan } = await readConfigs();
    const prov = await getAlchemyHttpProv(chainId);

    let abi;
    try {
        abi = await getContractAbi(etherscan, address);
    }
    catch (err) {
        console.log('Failed to retrieve contract abi for ' + address + ': ' + err.message);
    }

    const result = {
        isVerified: abi != null,
        allFns: []
    };
    for (const config of SCAN_CONFIGS) {
        result[config.category] = [];
    }

    // Categorize functions for verified contract
    if (abi) {
        const contract = new ethers.Contract(address, abi, prov);
        await Promise.all(abi.map(e => (async () => {
            if (!e || e.type !== 'function') return;

            const name = e.name;
            const sig = ethers.utils.Fragment.from(e).format(ethers.utils.FormatTypes.sighash);
            const isReadonly = kwMatches(e.stateMutability, ['view', 'pure']) && e.inputs.length === 0 && e.outputs.length > 0;

            // Find value of function
            let value = null;
            if (isReadonly) {
                try {
                    value = await contract[sig]();
                }
                catch (err) {
                    console.log('Failed to read value for function ' + sig + ': ' + err.message);
                }
            }

            result.allFns.push({ name: sig, value: value ? value.toString() : value });
            if (kwMatches(name, BLACKLIST)) return;

            // Classify readonly function
            if (isReadonly && value != null) {
                for (const config of SCAN_CONFIGS) {
                    if (!config.isReadonly) continue;
                    const params = { fnSig: sig, value };
                    if (config.isMatch(params)) {
                        result[config.category].push(config.getResult ? config.getResult(params) : { name: sig, value });
                    }
                }
            }
            // Classify state-change function
            else if (kwMatches(e.stateMutability, ['payable', 'nonpayable']) && e.outputs.length === 0) { 
                for (const config of SCAN_CONFIGS) {
                    if (config.isReadonly) continue;
                    const params = { fnSig: sig };
                    if (config.isMatch(params)) {
                        result[config.category].push(config.getResult ? config.getResult(params) : { name: sig });
                    }
                }
            }
        })()));
    }
    else {
        // Categorize functions for unverified contract
        const contract = new ethers.Contract(address, UNVERIFIED_ABI, prov);
        const tasks = [];
        for (const config of SCAN_CONFIGS) {
            for (const fn of (config.knownFns || [])) {
                if (config.isReadonly) {
                    const fnSig = fn.split(/\s+/)[0];
                    tasks.push(getFnValue(config, result[config.category], contract, fnSig));
                }
                else {
                    tasks.push(fnExists(result[config.category], contract, fn));
                }
            }
        }
        await Promise.all(tasks);
    }

    return result;
}

async function getFnValue(config, cfnArr, contract, fnSig) {
    if (!config || !Array.isArray(cfnArr) || !contract || !fnSig) {
        throw new Error('Missing required parameters');
    }
    try {
        const value = await contract[fnSig]();
        cfnArr.push(config.getResult ? config.getResult({ name: fnSig, value }) : { name: fnSig, value })
    }
    catch (err) {}
}

async function fnExists(cfnArr, contract, fnSig) {
    if (!Array.isArray(cfnArr) || !contract || !fnSig) {
        throw new Error('Missing required parameters');
    }
    try {
        await contract.callStatic[fnSig](...spoofParams(fnSig));
        cfnArr.push({ name: fnSig });
    }
    catch (err) {
        const message = err.error ? err.error.message : err.message;
        if (message.startsWith('execution reverted:')) {
            cfnArr.push({ name: fnSig });
        }
    }
}

// Spoofs parameters based on types in provided function signature
function spoofParams(fnSig) {
    if (!fnSig) {
        throw new Error('Missing function signature');
    }
    const types = (fnSig.substring(0, fnSig.length - 1).split('(')[1]);
    const params = types ? types.split(',').map(type => {
            if (type === 'address') return '0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e';
            else if (type === 'bytes') return [];
            else if (type.includes('int')) return 1;
            else if (type === 'bool') return true;
            return null;
        }) : [];
    return params;
}

function kwMatches(str, kws = []) {
    if (str == null || !Array.isArray(kws)) {
        throw new Error('Missing required parameters');
    }

    str = str.toLowerCase();
    let matches = false;
    for (const kw of kws) {
        if (kw.startsWith('-')) {
            if (str.includes(kw.substring(1).toLowerCase())) {
                return false;
            }
        }
        else if (!matches && str.includes(kw.toLowerCase())) {
            matches = true;
        }
    }
    return matches;
}

module.exports = scanFns;