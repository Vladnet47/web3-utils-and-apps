const ethers = require('ethers');

// Creates new eip1559 transaction
// All values are in pre-processed state (fees in gwei, )
function createTx(to, max, prio, limit, value, data, nonce, type) {
    if (!ethers.utils.isAddress(to)) {
        throw new Error('Missing to address');
    }
    if (!max) {
        throw new Error('Missing or invalid max fee');
    }
    if (!limit || limit < 21000) {
        throw new Error('Missing or invalid gas limit');
    }
    if (nonce == null || nonce < 0) {
        throw new Error('Missing or invalid nonce');
    }
    if (type != null) {
        if (type !== 0 && type !== 2) {
            throw new Error('Type must be 0 or 2');
        }
    }
    else {
        type = 2;
    }
    max = ethers.utils.parseUnits(max.toString(), 'gwei');
    value = value ? ethers.utils.parseEther(value.toString()) : ethers.BigNumber.from(0);

    if (type === 2) {
        return {
            to,
            maxFeePerGas: max,
            maxPriorityFeePerGas: prio ? ethers.utils.parseUnits(prio.toString(), 'gwei') : max,
            gasLimit: limit,
            value,
            type: type == null ? 2 : type,
            data: data || '0x',
            chainId: 1,
            nonce,
        };
    }
    else {
        return {
            to,
            gasPrice: max,
            gasLimit: limit,
            value,
            type: type == null ? 2 : type,
            data: data || '0x',
            chainId: 1,
            nonce,
        };
    }
}

// Formats and prints transaction
function printTx(tx = {}) {
    if (!tx) {
        throw new Error('Missing tx');
    }
    console.log(JSON.stringify({
        ...tx,
        gasPrice: tx.gasPrice ? ethers.utils.formatUnits(tx.gasPrice, 'gwei') : null,
        maxFeePerGas: tx.maxFeePerGas ? ethers.utils.formatUnits(tx.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.utils.formatUnits(tx.maxPriorityFeePerGas, 'gwei') : null,
        value: tx.value ? ethers.utils.formatEther(tx.value) : '0',
    }, null, 2));
}

// Encodes transaction
function encodeTx(tx = {}) {
    if (!tx) {
        throw new Error('Missing tx');
    }
    if (tx.type == null) {
        throw new Error('Missing tx type');
    }

    let serialized;
    if (tx.type === 0) {
        serialized = ethers.utils.serializeTransaction({
            to: tx.to,
            data: tx.data,
            gasPrice: tx.gasPrice,
            gasLimit: tx.gasLimit,
            chainId: tx.chainId,
            nonce: tx.nonce,
            value: tx.value
        }, {
            r: tx.r,
            s: tx.s,
            v: tx.v
        });
    }
    else {
        serialized = ethers.utils.serializeTransaction({
            to: tx.to,
            data: tx.data,
            maxFeePerGas: tx.maxFeePerGas,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
            gasLimit: tx.gasLimit,
            accessList: tx.accessList || [],
            type: 2,
            chainId: tx.chainId,
            nonce: tx.nonce,
            value: tx.value
        }, {
            r: tx.r,
            s: tx.s,
            v: tx.v
        });
    }

    const hash = ethers.utils.keccak256(serialized);
    if (tx.hash && hash !== tx.hash) {
        throw new Error('Serialization failed for tx ' + tx.hash + ': ' + serialized);
    }

    return serialized.toString();
}

function decodeTx(iface, tx) {
    if (!iface) {
        throw new Error('Missing contract interface');
    }
    if (!tx || !tx.data) {
        throw new Error('Missing tx or tx data');
    }
    return iface.parseTransaction(tx);
}

function encodeTxData(fnSig, params) {
    if (!fnSig || !fnSig.includes('(') || !fnSig.includes(')')) {
        throw new Error('Missing or invalid function signature');
    }
    const abi = [(fnSig.startsWith('function') ? '' : 'function ') + fnSig];
    const iface = new ethers.utils.Interface(abi);
    const sig = iface.fragments[0].format();
    try {
        return iface.encodeFunctionData(sig, params);
    }
    catch (err) {
        throw new Error('Invalid parameters for function signature: ' + err.message);
    }
}

function decodeTxData(iface, calldata) {
    if (!iface) {
        throw new Error('Missing contract interface');
    }
    if (!calldata) {
        throw new Error('Missing calldata');
    }
    if (calldata.length < 10) {
        throw new Error('Calldata is not function call');
    }
    try {
        const hash = calldata.substring(0, 10);
        const fragment = iface.getFunction(hash);
        const fn = fragment.name;
        const data = fragment ? iface.decodeFunctionData(fragment, calldata) : null;
        return { fn, data };
    }
    catch (err) {
        return { fn: null, data: null };
    }
}

function getTxCost(tx) {
    if (!tx) {
        throw new Error('Missing tx');
    }
    return getTxFee(tx).add(tx.value);
}

function getTxFee(tx) {
    if (!tx) {
        throw new Error('Missing tx');
    }
    if (tx.type == null) {
        throw new Error('Missing tx type');
    }
    if (tx.type === 2) {
        return tx.maxFeePerGas.add(tx.maxPriorityFeePerGas).mul(tx.gasLimit);
    }
    else {
        return tx.gasPrice.mul(tx.gasLimit);
    }
}

function getFrontrunFee(maxFee, prioFee) {
    if (!maxFee || !maxFee._isBigNumber) {
        throw new Error('Missing or invalid max fee');
    }
    if (prioFee && !prioFee._isBigNumber) {
        throw new Error('Invalid prio fee');
    }
    const frontrunFee = ethers.utils.parseUnits('1', 'gwei');
    maxFee = maxFee.add(frontrunFee);
    prioFee = prioFee ? prioFee.add(frontrunFee) : maxFee;
    maxFee = prioFee.gt(maxFee) ? prioFee : maxFee;
    return {
        maxFee,
        prioFee,
    };
}

module.exports = {
    createTx,
    printTx,
    encodeTx,
    decodeTx,
    getTxCost,
    getTxFee,
    encodeTxData,
    decodeTxData,
    getFrontrunFee,
};
