# web3-utils

## How to scan transactions for your wallets

1) Clone repo and install dependencies

```bash
git clone https://github.com/Vladnet47/web3-utils.git
cd web3-utils
npm install --production
```

2) Create file called **configs.json** in root project directory and add etherscan key and your wallet addresses. Etherscan key can be created using free plan at https://etherscan.io/apis.

```js
// Example configs.json
{
    "etherscanKey": "91XS663WVIIBMTQCNGNA98QKP7MHZ12U07",
    "wsEndpoint": "wss://eth-mainnet.alchemyapi.io/v2/_lXNVI-yluBd4gZadFNQj9LTPnKEOWUH",
    "wallets": [
        "0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C22",
        "0x1D52798dCAd378582Ce1f5fC6607f1Bb070dCe42"
    ]
}
```

3) Run from root directory.

```bash
node src/index.js
```

Sample output:

```
Successfully retrieved 18 regular txs for 0x1D52798dCAd378582Ce1f5fC6607f1Bb070dCe40
Successfully retrieved 3 internal txs for 0x1D52798dCAd378582Ce1f5fC6607f1Bb070dCe40
Wrote off tx 0x9cad688ec1bf7f106863e380d7055ae4ee2c74cb382f92641063a0d70c76e38f: is transfer
Wrote off tx 0x43f286e68287bf91142a14f734dabe6c1d790a5f1869a4b0848ff1e1bb4d3219: is transfer
Wrote off tx 0xd3435fe61220b9bd3d34a7322a2b1b492e9016ae016221d5e564966dd3f1c0c1: is writeoff fn setApprovalForAll
Wrote off tx 0x1a2ddea97469bb8faa8ee7d50f042e660f7068475fc61eaee6b7ecdd83d949b5: is transfer
Wrote off tx 0x017c10e5982604f1cc5b4cea10def75f1d65322bca3a782be5ca8915dcdc6a7c: is transfer
Wrote off tx 0x3621a0033b9722f7ca82ce1e9236e4a2de4fa4fe11de79ede2085441a7684e10: is transfer
Wrote off tx 0x095cec7385ff9d57eb0353043f892b87e1d4688ca2fcb12e83a654f7b9e45baf: is writeoff fn safeTransferFrom
Wrote off tx 0x602cbef976b58d7b0c5b209c38b13ed2324d9f550914cd3b5342fd0e7b92792a: is writeoff fn registerProxy
Wrote off tx 0xbc395f58806bec071f7e4b71a9c744a7f0986e382dec1d9975c406538324828c: is transfer
Wrote off tx 0x49219c0bcbd1779389a0a97aa9ba490da6892f9a7b38da301823bd9e40f64888: is writeoff fn transferFrom
Wrote off tx 0x99d3f80dc049e3a8c705aa5e26041f6f9c2911863be8ead6ceea98d50bb39047: is writeoff fn setApprovalForAll
Wrote off tx 0x032e33ba71e3f081961d4ae16ad7f2c9630516230560b7c8cb1cb28a18b1eb6f: is writeoff fn atomicMatch_
Wrote off tx 0x5df1999ec246da51a9c8b1e2ec9e501a9d3c29af07acfd9a39927235f318bb4b: is failed tx
Wrote off tx 0xe01131b26079202c5f6bd37b2a3a8f00fccaa81c69ce8b4872850580400e23cf: is writeoff fn safeTransferFrom
Wrote off tx 0xb388b8c00a9ca6459f9d35a2d5ba27ee65e02a010895c02e6d772f3592f18fbc: is transfer
Wrote off 15/21 txs: 0.180411180312397294
```