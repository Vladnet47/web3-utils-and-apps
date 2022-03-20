# web3-utils

## How to run

1) Clone the repo and install dependencies. You must have [Node.js](https://nodejs.org/en/download/) available on your system.

```bash
git clone https://github.com/Vladnet47/web3-utils.git
cd web3-utils
npm install --production
```

2) Navigate to project folder and make a file called *configs.json*. Follow this link to [generate a free Etherscan key](https://etherscan.io/apis).

```js
// Example configs.json
{
    "etherscanKey": "91XSD63WVIIBHTQCNGDA98QKK7MHZ12U07",
    "wallets": [
        "0x643Fc89a2a5e435B3C6382A2B53Ab92a7Ee5c95B",
        "0x630B5AD55799dCAd378582Ce1f5fC6607f1Bb070"
    ],
    "flags": {
    }
}
```

3) Run the script.

```bash
npm run scan
```