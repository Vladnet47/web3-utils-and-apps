const ethers = require('ethers');
const { Token } = require('../../../src/apps/farming/objects');
const { getNftyHttpsProv, decodeTx, LooksRequests, readConfigs } = require('../../../src/utils');

process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

// index.esm.js:formatted
const mainnetAddresses = {
    LOOKS: "0xf4d2888d29D722226FafA5d9B24F9164c092421E",
    LOOKS_LP: "0xDC00bA87Cc2D99468f7f34BC04CBf72E111A32f7",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    ROYALTY_FEE_MANAGER: "0x7358182024c9f1B2e6b0153e60bf6156B7eF4906",
    ROYALTY_FEE_REGISTRY: "0x55010472a93921a117aAD9b055c141060c8d8022",
    ROYALTY_FEE_SETTER: "0x66466107d9cAE4da0176a699406419003F3C27a8",
    EXCHANGE: "0x59728544B08AB483533076417FbBB2fD0B17CE3a",
    TRANSFER_MANAGER_ERC721: "0xf42aa99F011A1fA7CDA90E5E98b277E306BcA83e",
    TRANSFER_MANAGER_ERC1155: "0xFED24eC7E22f573c2e08AEF55aA6797Ca2b3A051",
    TRANSFER_SELECTOR_NFT: "0x9Ba628F27aAc9B2D78A9f2Bf40A8a6DF4Ccd9e2c",
    STRATEGY_STANDARD_SALE: "0x56244Bb70CbD3EA9Dc8007399F61dFC065190031",
    STRATEGY_COLLECTION_SALE: "0x86F909F70813CdB1Bc733f4D97Dc6b03B8e7E8F3",
    STRATEGY_PRIVATE_SALE: "0x58D83536D3EfeDB9F7f2A1Ec3BDaad2b1A4DD98C",
    STRATEGY_DUTCH_AUCTION: "0x3E80795Cae5Ee215EBbDf518689467Bf4243BAe0",
    PRIVATE_SALE_WITH_FEE_SHARING: "0x9571cdD8ACB71C83393290F0D63A46173dddE65B",
    FEE_SHARING_SYSTEM: "0xBcD7254A1D759EFA08eC7c3291B2E85c5dCC12ce",
    STAKING_POOL_FOR_LOOKS_LP: "0x2A70e7F51f6cd40C3E9956aa964137668cBfAdC5",
    TOKEN_DISTRIBUTOR: "0x465A790B428268196865a3AE2648481ad7e0d3b1",
    TRADING_REWARDS_DISTRIBUTOR: "0x453c1208B400fE47aCF275315F14E8F9F9fbC3cD",
    MULTI_REWARDS_DISTRIBUTOR: "0x0554f068365eD43dcC98dcd7Fd7A8208a5638C72",
    MULTICALL2: "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
    REVERSE_RECORDS: "0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C",
    AGGREGATOR_UNISWAP_V3: "0x3ab16Af1315dc6C95F83Cbf522fecF98D00fd9ba",
};

async function main() {
    const looksRequests = new LooksRequests(false); 
    const { privateKeys } = await readConfigs();   
    const prov = await getNftyHttpsProv();
    const signer = new ethers.Wallet(privateKeys.vdog, prov);
    // const res = await looksRequests.createListing(
    //     signer, 
    //     new Token('0xfb7d186E24E128be1F1339fB9C2bA6fDBd87C6f9', 14583), 
    //     ethers.utils.parseEther('0.009'),
    //     33,
    //     1
    // );
    // console.log('Response:');
    // console.log(JSON.stringify(res, null, 2));

    const collection = await looksRequests.getCollection('0xfb7d186E24E128be1F1339fB9C2bA6fDBd87C6f9');
    console.log('Nonce: ' + JSON.stringify(collection, null, 2));
}

main().catch(console.log);