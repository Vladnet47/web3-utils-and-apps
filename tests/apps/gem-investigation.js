const ethers = require('ethers');
const { getNftyHttpsProv, decodeTx } = require('../../src/utils');

const TX_HASH = '0xae10552105783ae94523d87b4a1c947c13e254b7903892237fed2a282ab4071b'; // batchBuyWithETH
process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

const IFACE = new ethers.utils.Interface([
    'function matchAskWithTakerBidUsingETHAndWETH((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchAskWithTakerBid((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function matchBidWithTakerAsk((bool,address,uint256,uint256,uint256,bytes),(bool,address,address,uint256,uint256,uint256,address,address,uint256,uint256,uint256,uint256,bytes,uint8,bytes32,bytes32)) payable returns()',
    'function batchBuyFromOpenSea(tuple(uint256 value, bytes tradeData)[] openseaTrades) payable',
    'function batchBuyWithETH(tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails) payable',
    'function batchBuyWithERC20s(tuple(address[] tokenAddrs, uint256[] amounts) erc20Details, tuple(uint256 marketId, uint256 value, bytes tradeData)[] tradeDetails, tuple(bytes conversionData)[] converstionDetails, address[] dustTokens) payable',
]);

// Looksrare
// marketId = 16
// proxy = 0x90eE132f7A487085d6A582d3db0b731631DCD920
// _isLib = true
// _isActive = true
// 0xb4e4b296 -> matchAskWithTakerBidUsingETHAndWETH
// 0x38e29209 -> matchAskWithTakerBid
// 0x3b6d032e -> matchBidWithTakerAsk

async function main() {
    IFACE.fragments.forEach(f => console.log(IFACE.getSighash(f) + ' -> ' + f.name))

    const prov = await getNftyHttpsProv();
    const tx = await prov.getTransaction(TX_HASH);
    const decoded = await decodeTx(IFACE, tx);
    const decodedData = decoded.args;
    const tradeDetails = decodedData.tradeDetails;

    const firstTrade = tradeDetails[0];
    const marketId = firstTrade.marketId.toString();
    const value = ethers.utils.formatEther(firstTrade.value);
    console.log(marketId);
    console.log(value);

    const tradeData = firstTrade.tradeData.toString();
    const tdSigHash = tradeData.substring(0,10);
    const tdParams = tradeData.substring(10);
    const indivParams = tdParams.match(/.{1,64}/g);
    const indivParamsNum = indivParams.map(p => ethers.BigNumber.from('0x' + p).toString());
    console.log(JSON.stringify(indivParamsNum, null, 2));

}

main().catch(console.log);