# web3-utils

## How to scan transactions for your wallets

1) Clone repo and install dependencies

```bash
git clone https://github.com/Vladnet47/web3-utils.git
cd web3-utils
npm install --production
```

2) Create file called **configs.json** in root project directory and add etherscan key. Etherscan key can be created using free plan at https://etherscan.io/apis.

```js
// Example configs.json
{
    "etherscanKey": "91XS663WVIIBMTQCNGNA98QKP7MHZ12U07"
}
```

3) In **src/scan-tx.js**, add one or more ethereum addresses to WALLETS.

4) Run script from root directory.

```bash
node src/scan-tx.js
```