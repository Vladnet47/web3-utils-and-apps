const ethers = require('ethers');
const { handleTx } = require('../../src/apps/looks-farmer/main');
const { getAlchemyHttpProv } = require('../../src/utils');

const TX_HASH = '0x35aa20e6466b7d98324812e9f754c66cfcfef680cd3186922a4bb8bed3d1b8be';
process.env.PATH_TO_CONFIGS = '/home/vdog/workspace/private/web3-utils/configs.json';

async function main() {
    const prov = await getAlchemyHttpProv();
    const tx = await prov.getTransaction(TX_HASH);
    await handleTx(tx);
}

main().catch(console.log);

// 0x82aefbf989bd3fc779f72c11d6985d77eacfb6f9b64e08a796f37732953f8c57
// matchAskWithTakerBidUsingETHAndWETH
// [
//     [
//       false,
//       "0x6629fEd85da605e5bc1fA2F71A4A1e6C9545Be13",
//       {
//         "type": "BigNumber",
//         "hex": "0x1f360d9593da8000"
//       },
//       {
//         "type": "BigNumber",
//         "hex": "0x46b0"
//       },
//       {
//         "type": "BigNumber",
//         "hex": "0x2134"
//       },
//       "0x"
//     ],
//     [
//       true,
//       "0xe2590f9300db4aAD29807D50d8D683C90D20BB9D",
//       "0x306b1ea3ecdf94aB739F1910bbda052Ed4A9f949",
//       {
//         "type": "BigNumber",
//         "hex": "0x1f360d9593da8000"
//       },
//       {
//         "type": "BigNumber",
//         "hex": "0x46b0"
//       },
//       {
//         "type": "BigNumber",
//         "hex": "0x01"
//       },
//       "0x56244Bb70CbD3EA9Dc8007399F61dFC065190031",
//       "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
//       {
//         "type": "BigNumber",
//         "hex": "0x0c"
//       },
//       {
//         "type": "BigNumber",
//         "hex": "0x6279f54f"
//       },
//       {
//         "type": "BigNumber",
//         "hex": "0x627a9b97"
//       },
//       {
//         "type": "BigNumber",
//         "hex": "0x2134"
//       },
//       "0x",
//       28,
//       "0x719b46f910fbdd95f4d010acb9ad383a78f647339464f8abb1aee6a991b0bae0",
//       "0x3bbb196bfc1940a9bdf47ffe9059c625c506cd431d57a06c4040ba6048f16cdf"
//     ]
//   ]