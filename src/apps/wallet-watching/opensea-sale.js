const { notify } = require('../../utils');

const TARGETS = new Map();
TARGETS.set('0xfded90a3b1348425577688866f798f94d77a0d02'.toLowerCase(), 'fvckrender');
TARGETS.set('0x5ea9681c3ab9b5739810f8b91ae65ec47de62119'.toLowerCase(), 'Gary Vee');
TARGETS.set('0x5338035c008ea8c4b850052bc8dad6a33dc2206c'.toLowerCase(), 'mevcollector');
TARGETS.set('0x2ce780d7c743a57791b835a9d6f998b15bbba5a4'.toLowerCase(), 'pak');
TARGETS.set('0xfd22004806a6846ea67ad883356be810f0428793'.toLowerCase(), 'punk6529');
TARGETS.set('0xe4bbcbff51e61d0d95fcc5016609ac8354b177c4'.toLowerCase(), 'SteveAoki');
TARGETS.set('0x716eb921f3b346d2c5749b5380dc740d359055d7'.toLowerCase(), 'crypto888crypto');
TARGETS.set('0xae4d837caa0c53579f8a156633355df5058b02f3'.toLowerCase(), 'Alex Becker');
TARGETS.set('0xc6b0562605d35ee710138402b878ffe6f2e23807'.toLowerCase(), 'beeple');

const OPENSEA_ADDR = [
    '0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b'.toLowerCase(),
    '0x7f268357a8c2552623316e2562d90e642bb538e5'.toLowerCase()
];
const PURCHASE_FN = '0xab834bab'.toLowerCase();
const OPENSEA_IFACE = new ethers.utils.Interface([
    'function atomicMatch_(address[14],uint256[18],uint8[8],bytes,bytes,bytes,bytes,bytes,bytes,uint8[2],bytes32[5]) payable returns()'
]);

async function main(tx) {
    if (!tx || !tx.to) {
        throw new Error('Missing or invalid tx');
    }

    // Check if opensea mint
    const opensea = tx.to.toLowerCase(); 
    if (!OPENSEA_ADDR.includes(opensea) || !tx.data || !tx.data.toLowerCase().startsWith(PURCHASE_FN)) {
        return;
    }

    // Parse the transaction
    const hash = tx.hash;
    const parsed = OPENSEA_IFACE.parseTransaction(tx);
    const addrs = parsed.args[0];
    const uints = parsed.args[1];
    const to = addrs[1].toLowerCase(); // DEBUG addrs[0]
    const from = addrs[2].toLowerCase();
    const calldata = parsed.args[4];
    const price = ethers.utils.formatEther(uints[4]);

    // Check if from/to address belongs to one of the target wallets
    const [target, isBuy] = (() => {
        const toTarget = TARGETS.get(to);
        if (toTarget) {
            return [toTarget, true];
        }
        else {
            const fromTarget = TARGETS.get(from);
            if (fromTarget) {
                return [fromTarget, false];
            }
        }
        return [null, null];
    })();
    if (!target) {
        console.log('WARN: failed to parse target for ' + hash);
        return;
    }

    const { tokenId, calldataTokenContract } = parseTokenId(calldata);
    if (!tokenId) {
        console.log('WARN: failed to parse token id for ' + hash);
        return;
    }
    const tokenContract = calldataTokenContract || addrs[4];

    // Notify discord
    const title = '[OS] ' + target.name + (isBuy ? ' bought ' : ' sold ') + '0x...' + tokenContract.substring(tokenContract.length - 4) + ' for ' + price + 'Ξ';
    const url = 'https://opensea.io/assets/' + tokenContract + '/' + tokenId;
    await notify(title, url);
}

const TRANSFER_IFACE = new ethers.utils.Interface([
    'function transferFrom(address,address,uint256)',
    'function safeTransferFrom(address,address,uint256,uint256,bytes)',
    'function safeTransferFrom(address,address,uint256,bytes)',
    'function safeTransferFrom(address,address,uint256)',
    'function atomicize(address[],uint256[],uint256[],bytes)',
    'function matchERC1155UsingCriteria(address,address,address,uint256,uint256,bytes32,bytes32[])',
    'function matchERC721UsingCriteria(address,address,address,uint256,bytes32,bytes32[])',
    'function matchERC721WithSafeTransferUsingCriteria(address,address,address,uint256,bytes32,bytes32[])'
]);

function parseTokenId(calldata) {
    if (!calldata) {
        return {};
    }

    calldata = calldata.toLowerCase();
    if (calldata.startsWith('0xf242432a'.toLowerCase())) {
        return {
            tokenId: TRANSFER_IFACE.decodeFunctionData('safeTransferFrom(address,address,uint256,uint256,bytes)', calldata)[3].toString()
        };
    }
    else if (calldata.startsWith('0x42842e0e'.toLowerCase())) {
        return {
            tokenId: TRANSFER_IFACE.decodeFunctionData('safeTransferFrom(address,address,uint256)', calldata)[3].toString()
        };
    }
    else if (calldata.startsWith('0xb88d4fde'.toLowerCase())) {
        return {
            tokenId: TRANSFER_IFACE.decodeFunctionData('safeTransferFrom(address,address,uint256,bytes)', calldata)[3].toString()
        };
    }
    else if (calldata.startsWith('0x23b872dd')) {
        return { 
            tokenId: TRANSFER_IFACE.decodeFunctionData('transferFrom', calldata)[2].toString()
        };
    }
    else if (calldata.startsWith('0x68f0bcaa')) {
        const decoded = TRANSFER_IFACE.decodeFunctionData('atomicize', calldata);
        return {
            tokenId: this._getTokenId(decoded[3])
        };
    }
    else if (calldata.startsWith('0x96809f90')) {
        const decoded = TRANSFER_IFACE.decodeFunctionData('matchERC1155UsingCriteria', calldata);
        return {
            tokenId: decoded[3].toString(),
            calldataTokenContract: decoded[2]
        };
    }
    else if (calldata.startsWith('0xfb16a595')) {
        const decoded = TRANSFER_IFACE.decodeFunctionData('matchERC721UsingCriteria', calldata);
        return {
            tokenId: decoded[3].toString(),
            calldataTokenContract: decoded[2]
        };
    }
    else if (calldata.startsWith('0xc5a0236e')) {
        const decoded = TRANSFER_IFACE.decodeFunctionData('matchERC721WithSafeTransferUsingCriteria', calldata);
        return {
            tokenId: decoded[3].toString(),
            calldataTokenContract: decoded[2]
        };
    }
    else {
        throw new Error('Unknown calldata: ' + calldata);
    }
}

module.exports = main;