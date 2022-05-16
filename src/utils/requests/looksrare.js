const ethers = require('ethers');
const HttpRequests = require('./http');

const URL = 'https://api.looksrare.org/graphql';
const HEADERS = {
    'authority': 'api.looksrare.org',
    'method': 'POST',
    'path': '/graphql',
    'scheme': 'https',
    'authorization': 'Bearer undefined',
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'dnt': '1',
    'origin': 'https://looksrare.org',
    'referer': 'https://looksrare.org/',
    'sec-ch-ua': '"Not A;Brand";v="99", "Chromium";v="101", "Google Chrome";v="101"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36'
};

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const STRATEGY = '0x56244Bb70CbD3EA9Dc8007399F61dFC065190031';
const EXCHANGE = '0x59728544B08AB483533076417FbBB2fD0B17CE3a';
const MAKER_ORDER_SIG_DOMAIN = {
    name: 'LooksRareExchange',
    version: '1',
    chainId: 1,
    verifyingContract: EXCHANGE,
};
const MAKER_ORDER_SIG_TYPES = {
    MakerOrder: [
        { name: "isOrderAsk", type: "bool" },
        { name: "signer", type: "address" },
        { name: "collection", type: "address" },
        { name: "price", type: "uint256" },
        { name: "tokenId", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "strategy", type: "address" },
        { name: "currency", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "startTime", type: "uint256" },
        { name: "endTime", type: "uint256" },
        { name: "minPercentageToAsk", type: "uint256" },
        { name: "params", type: "bytes" },
    ],
};

class LooksRequests extends HttpRequests {
    async getListing(token) {
        if (!token) {
            throw new Error('Missing token');
        }

        const body = {
            query: "\n    query GetToken($collection: Address!, $tokenId: String!) {\n      token(collection: $collection, tokenId: $tokenId) {\n        id\n        tokenId\n        image {\n          src\n          contentType\n        }\n        name\n        countOwners\n        description\n        animation {\n          src\n          contentType\n          original\n        }\n        lastOrder {\n          price\n          currency\n        }\n        collection {\n          name\n          address\n          type\n          isVerified\n          points\n          totalSupply\n          description\n          owner {\n            ...CollectionOwnerFragment\n          }\n          floorOrder {\n            price\n          }\n          floor {\n            floorPriceOS\n            floorPrice\n            floorChange24h\n            floorChange7d\n            floorChange30d\n          }\n        }\n        ask {\n          ...OrderFragment\n        }\n        attributes {\n          ...AttributeFragment\n        }\n      }\n    }\n    \n  fragment AttributeFragment on Attribute {\n    traitType\n    value\n    displayType\n    count\n    floorOrder {\n      price\n    }\n  }\n\n    \n  fragment OrderFragment on Order {\n    isOrderAsk\n    signer\n    collection {\n      address\n    }\n    price\n    amount\n    strategy\n    currency\n    nonce\n    startTime\n    endTime\n    minPercentageToAsk\n    params\n    signature\n    token {\n      tokenId\n    }\n    hash\n  }\n\n    \n  fragment CollectionOwnerFragment on User {\n    address\n    name\n    isVerified\n    avatar {\n      id\n      tokenId\n      image {\n        src\n        contentType\n      }\n    }\n  }\n\n  ",
            variables: {
                collection: token.address.toString(),
                tokenId: token.id.toString()
            }
        };

        const res = await this.post(URL, body, HEADERS, 'json');
        if (!res || !res.data || !res.data.token) {
            throw new Error('Response data invalid format');   
        }

        return {
            floorPrice: ethers.utils.parseEther(res.data.token.collection.floorOrder.price),
            floorPriceOS: ethers.utils.parseEther(res.data.token.collection.floor.floorPriceOS),
            isListed: res.data.token.ask != null,
            price: res.data.token.ask ? ethers.utils.parseEther(res.data.token.ask.price) : null,
            nonce: res.data.token.ask ? res.data.token.ask.nonce : null,
        };
    }

    // Duration in minutes
    async createListing(signer, token, price, nonce, duration) {
        if (!signer || !signer._isSigner) {
            throw new Error('Missing or invalid signer');
        }
        if (!token) {
            throw new Error('Missing token');
        }
        if (!price || !price._isBigNumber) {
            throw new Error('Missing or invalid price');
        }
        if (nonce == null || nonce < 0) {
            throw new Error('Missing or invalid listing nonce');
        }
        if (duration < 1) {
            throw new Error('Missing or invalid duration');
        }

        // Generate signature over query parameters
        const startTime = Math.round(new Date().getTime() / 1000);
        const endTime = Math.round((startTime + Math.round(duration * 60)) / 100) * 100;
        const variables = {
            isOrderAsk: true,
            signer: signer.address,
            collection: token.address,
            price: price.toString(),
            tokenId: token.id,
            amount: '1',
            strategy: STRATEGY,
            currency: WETH,
            nonce,
            startTime,
            endTime,
            minPercentageToAsk: 8500,
            params: [],
        };
        const signature = await signer._signTypedData(MAKER_ORDER_SIG_DOMAIN, MAKER_ORDER_SIG_TYPES, variables);
        variables.signature = signature;

        // Create graphql query
        const body = {
            query: '\n    mutation CreateOrderMutation($data: OrderCreateInput!) {\n      createOrder(data: $data) {\n        ...OrderFragment\n      }\n    }\n    \n  fragment OrderFragment on Order {\n    isOrderAsk\n    signer\n    collection {\n      address\n    }\n    price\n    amount\n    strategy\n    currency\n    nonce\n    startTime\n    endTime\n    minPercentageToAsk\n    params\n    signature\n    token {\n      tokenId\n    }\n    hash\n  }\n\n',
            variables: { data: variables },
        };

        const res = await this.post(URL, body, HEADERS, 'json');
        if (!res || !res.data || !res.data.createOrder) {
            throw new Error('Response data invalid format');
        }

        const o = res.data.createOrder;
        return {
            hash: o.hash,
            price: ethers.BigNumber.from(o.price),
            nonce: parseInt(o.nonce),
            endTime: new Date(parseInt(o.endTime) * 1000),
        };
    }

    async getNonce(user) {
        if (!user || !ethers.utils.isAddress(user)) {
            throw new Error('Missing or invalid user');
        }

        const body = {
            query: "\n    query GetUserNonce($address: Address!) {\n      user(address: $address) {\n        nonce\n      }\n    }\n",
            variables: {
                address: user
            }
        };

        const res = await this.post(URL, body, HEADERS, 'json');
        if (!res || !res.data || !res.data.user) {
            throw new Error('Response data invalid format');
        }

        return parseInt(res.data.user.nonce);
    }

    async isTokenOwner(user, token) {
        if (!user || !ethers.utils.isAddress(user)) {
            throw new Error('Missing or invalid user');
        }
        if (!token) {
            throw new Error('Missing token');
        }

        const body = {
            query: "\n    query GetUserNonce($address: Address!) {\n      user(address: $address) {\n        nonce\n      }\n    }\n",
            variables: {
                address: user
            }
        };
        
        user = user.toLowerCase();
        const res = await this.post(URL, body, HEADERS, 'json');
        if (!res || !res.data || !res.data.token || !res.data.token.owners) {
            throw new Error('Response data invalid format'); 
        }

        const owners = res.data.token.owners;
        for (const spec of owners) {
            if (spec.owner.address.toLowerCase() === user) {
                return true;
            }
        }
        return false;
    }
}

module.exports = LooksRequests;