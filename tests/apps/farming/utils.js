const ethers = require('ethers');

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a';
const GEM_ADDRESS = '0x83c8f28c26bf6aaca652df1dbbe0e1b56f8baba2';
const IFACE = new ethers.utils.Interface([
    'function matchAskWithTakerBidUsingETHAndWETH((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchAskWithTakerBid((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function batchBuyWithETH(tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails) payable',
]);

function createLooksrareBuyTx(listing, maxFee, prioFee) {
    if (!listing || maxFee == null || prioFee == null) {
        throw new Error('Missing required parameters');
    }

    const price = ethers.utils.parseEther('0.1');
    const tokenId = ethers.BigNumber.from(listing.token.tokenId);
    listingNonce = ethers.BigNumber.from(listing.nonce.toString());
    maxFee = ethers.utils.parseUnits(maxFee.toString(), 'gwei');
    prioFee = ethers.utils.parseUnits(prioFee.toString(), 'gwei');
    return {
        to: LOOKS_ADDRESS,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: prioFee,
        gasLimit: 150000,
        value: price,
        type: 2,
        data: IFACE.encodeFunctionData('matchAskWithTakerBidUsingETHAndWETH', [
            [
                false,
                '0x1D52798dCAd378582Ce1f5fC6607f1Bb070dCe40',
                price,
                tokenId,
                ethers.BigNumber.from('8500'),
                '0x'
            ], 
            [
                true,
                '0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C2d',
                listing.token.address,
                price,
                tokenId,
                ethers.BigNumber.from('1'),
                '0x56244Bb70CbD3EA9Dc8007399F61dFC065190031',
                '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                listingNonce,
                ethers.BigNumber.from('1652175030'),
                ethers.BigNumber.from('1654767016'),
                ethers.BigNumber.from('8500'),
                '0x',
                28,
                '0xdc7d84e7761ac49a5247ec037d17e888edff30fcaea4deaf98d1476b509a824e',
                '0x08cf788ce823c2117b5df3cb4f00a54ec233c5ec32a835731ef6b54bd3513661'
            ]
        ]),
        chainId: 1,
        nonce: 15,
    };
}

function createGemBuyTx(listings, maxFee, prioFee) {
    if (!Array.isArray(listings) || listings.length === 0 || maxFee == null || prioFee == null) {
        throw new Error('Missing required parameters');
    }

    const price = ethers.utils.parseEther('1');
    const indivPrice = price.div(10);
    maxFee = ethers.utils.parseUnits(maxFee.toString(), 'gwei');
    prioFee = ethers.utils.parseUnits(prioFee.toString(), 'gwei');
    const marketId = ethers.BigNumber.from('16');

    const tradeData = (() => {
        if (listings.length > 10) {
            throw new Error('10 or more listings not supported');
        }
        let data = '0xf3e81623' +
            '0000000000000000000000000000000000000000000000000000000000000040' +
            '0000000000000000000000000000000000000000000000000000000000000000' +
            '000000000000000000000000000000000000000000000000000000000000000' + listings.length;
        for (const listing of listings) {
            const tokenId = ethers.BigNumber.from(listing.token.tokenId)._hex.substring(2);
            const tokenContract = listing.token.address.substring(2);
            const listingNonce = ethers.BigNumber.from(listing.nonce)._hex.substring(2);
            data += "0000000000000000000000000000000000000000000000000000000000000001" +
                "00000000000000000000000000000000000000000000000026db992a3b180000" +
                "0000000000000000000000000000000000000000000000000000000000000000".substring(tokenId.length) + tokenId +
                "0000000000000000000000000000000000000000000000000000000000000001" +
                "0000000000000000000000000000000000000000000000000000000000000000".substring(listingNonce.length) + listingNonce +
                "00000000000000000000000000000000000000000000000000000000627c29ed" +
                "00000000000000000000000000000000000000000000000000000000627c45cc" +
                "0000000000000000000000000000000000000000000000000000000000002134" +
                "000000000000000000000000000000000000000000000000000000000000001c" +
                "c4df0ea9f9c7a46fcdb02402600cee4b75c2dee35ba70db90c5b93dc22b7d6e5" +
                "35fcb72252c8e21c1d02c6fc91965113c6012cfb02a966ff6063d64ec261461f" +
                "0000000000000000000000004f23f946562d26f62a80c06b4a6909da371cc4f7" +
                "000000000000000000000000" + tokenContract;
        }
        return data;
    })();

    // console.log(ethers.utils.arrayify(tradeData));
    // //console.log(ethers.utils.hexlify(tradeData));
    // return;

    return {
        to: GEM_ADDRESS,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: prioFee,
        gasLimit: 150000,
        value: price,
        type: 2,
        data: IFACE.encodeFunctionData('batchBuyWithETH', [
            [
                [
                    marketId,
                    indivPrice,
                    ethers.utils.arrayify(tradeData),
                ]
            ]
        ]),
        chainId: 1,
        nonce: 15,
    };
}

module.exports = {
    createLooksrareBuyTx,
    createGemBuyTx
};
