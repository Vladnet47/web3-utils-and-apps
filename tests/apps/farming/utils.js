const ethers = require('ethers');

const LOOKS_ADDRESS = '0x59728544b08ab483533076417fbbb2fd0b17ce3a';
const IFACE = new ethers.utils.Interface([
    'function matchAskWithTakerBidUsingETHAndWETH((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchAskWithTakerBid((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    //'function matchBidWithTakerAsk((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    //'function batchBuyFromOpenSea(tuple(uint256 value, bytes tradeData)[] openseaTrades) payable',
    'function batchBuyWithETH(tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails) payable',
    //'function batchBuyWithERC20s(tuple(address[] tokenAddrs, uint256[] amounts) erc20Details, tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails, tuple(bytes conversionData)[] converstionDetails, address[] dustTokens) payable',
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

module.exports = {
    createLooksrareBuyTx,
    createGemBuyTx
};
