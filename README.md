# web3-utils

## How to run

1) Clone repo and install dependencies. You must have [Node.js](https://nodejs.org/en/download/) on your system.

```bash
git clone https://github.com/Vladnet47/web3-utils.git
cd web3-utils
npm install --production
```

2) Navigate to project folder and make a file called *configs.json*. A free Etherscan key can be generated [here](https://etherscan.io/apis).

```js
// Example configs.json
{
    "etherscanKey": "91XS663WVIIBHTQCNGNA98QKP7MHZ12U07",
    "wallets": [
        "0x743Fc8Ba2a5e435B376bD2a7Ee5c95B470C85C22",
        "0x1D52798dCAd378582Ce1f5fC6607f1Bb070dCe42"
    ],
    "flags": {
        "expenseGasFees": true,
    }
}
```

3) Run the script.

```bash
npm run scan
```