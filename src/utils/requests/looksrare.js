const ethers = require('ethers');
const HttpRequests = require('./http');

class LooksRequests extends HttpRequests {
    async getListing(tokenContract, tokenId) {
        if (!tokenContract) {
            throw new Error('Missing token contract');
        }
        if (tokenId == null) {
            throw new Error('Missing token id');
        }

        const url = 'https://api.looksrare.org/graphql';
        const headers = {
            'authority': 'api.looksrare.org',
            'method': 'POST',
            'path': '/graphql',
            'scheme': 'https',
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

        const body = {
            query: "\n    query GetToken($collection: Address!, $tokenId: String!) {\n      token(collection: $collection, tokenId: $tokenId) {\n        id\n        tokenId\n        image {\n          src\n          contentType\n        }\n        name\n        countOwners\n        description\n        animation {\n          src\n          contentType\n          original\n        }\n        lastOrder {\n          price\n          currency\n        }\n        collection {\n          name\n          address\n          type\n          isVerified\n          points\n          totalSupply\n          description\n          owner {\n            ...CollectionOwnerFragment\n          }\n          floorOrder {\n            price\n          }\n          floor {\n            floorPriceOS\n            floorPrice\n            floorChange24h\n            floorChange7d\n            floorChange30d\n          }\n        }\n        ask {\n          ...OrderFragment\n        }\n        attributes {\n          ...AttributeFragment\n        }\n      }\n    }\n    \n  fragment AttributeFragment on Attribute {\n    traitType\n    value\n    displayType\n    count\n    floorOrder {\n      price\n    }\n  }\n\n    \n  fragment OrderFragment on Order {\n    isOrderAsk\n    signer\n    collection {\n      address\n    }\n    price\n    amount\n    strategy\n    currency\n    nonce\n    startTime\n    endTime\n    minPercentageToAsk\n    params\n    signature\n    token {\n      tokenId\n    }\n    hash\n  }\n\n    \n  fragment CollectionOwnerFragment on User {\n    address\n    name\n    isVerified\n    avatar {\n      id\n      tokenId\n      image {\n        src\n        contentType\n      }\n    }\n  }\n\n  ",
            variables: {
                collection: tokenContract.toString(),
                tokenId: tokenId.toString()
            }
        };
        
        try {
            const res = await this.post(url, body, headers, 'json');
            if (res && res.data && res.data.token) {
                return {
                    floorPrice: ethers.utils.parseEther(res.data.token.collection.floorOrder.price),
                    floorPriceOS: ethers.utils.parseEther(res.data.token.collection.floor.floorPriceOS),
                    price: res.data.token.ask ? ethers.utils.parseEther(res.data.token.ask.price) : null,
                    listingNonce: res.data.token.ask ? res.data.token.ask.nonce : null,
                };
            }
            else {
                return {};
            }
        }
        catch (err) {
            console.log('Failed to retrieve lookrare listing for ' + tokenContract + ' ' + tokenId + ': ' + err.message);
            return {};
        }
    }
}

module.exports = LooksRequests;