const fs = require('fs');
const { Mutex } = require('async-mutex');
const csvToJson = require('csvtojson');
const tunnel = require('tunnel');
const got = require('got');
const repo = require('./repo');

class KycManager {
    constructor(kycPath, dbHost, dbPort, dbDatabase, dbUser, dbPass) {
        if (!kycPath) {
            throw new Error('Missing kyc path');
        }
        this._wallets = new Map();
        this._balances = new Map();
        this._proxies = [];
        this._proxyMutex = new Mutex();
        this._proxyI = 0;
        this._kycPath = kycPath;
        this._dbHost = dbHost;
        this._dbPort = dbPort;
        this._dbDatabase = dbDatabase;
        this._dbUser = dbUser;
        this._dbPass = dbPass;
    }

    get useProxy() {

        return this._proxies.length > 0;
    }

    async load() {
        await Promise.all([
            this._loadAddrs(),
            this._loadProxies(),
        ]);
    }

    async _loadProxies() {
        const startTime = new Date();
        await repo.open(this._dbHost, this._dbPort, this._dbDatabase, this._dbUser, this._dbPass);
        this._proxies = await repo.getProxies();
        await repo.close();
        console.log('Loaded ' + this._proxies.length + ' proxies in ' + (new Date() - startTime) + 'ms');
    }

    async _loadAddrs() {
        const startTime = new Date();
        this._wallets.clear();
        const exists = await this._fileExists();
        if (exists) {
            const csv = await csvToJson({ trim: true }).fromFile(this._kycPath);
            for (const w of csv) {
                this._wallets.set(w.addr, w.kyc);
            }
        }
        console.log('Loaded all known kyc addresses in ' + (new Date() - startTime) + 'ms');
    }

    async _fileExists() {
        try {
            await fs.promises.access(this._kycPath);
            return true;
        }
        catch (err) {
            return false;
        }
    }

    async save() {
        const startTime = new Date();
        let csv = 'addr,kyc\n';
        for (const [addr, kyc] of this._wallets.entries()) {
            csv += addr + ',' + kyc + '\n';
        }
        await fs.promises.writeFile(this._kycPath, csv);
        console.log('Updated kyc address cache in ' + (new Date() - startTime) + 'ms');
    }

    isCached(address) {
        return this._wallets.has(address.toLowerCase());
    }

    async isKyc(address) {
        if (!address) {
            throw new Error('Missing address');
        }
        const startTime = new Date();
        const addressLc = address.toLowerCase();
        if (this._wallets.has(addressLc)) {
            const kyc = this._wallets.get(addressLc);
            //console.log('Retrieved kyc status from cache in ' + (new Date() - startTime) + 'ms for ' + address + ': ' + kyc);
            return kyc === 'true';
        }
        else {
            //const kyc = await this._isKycApiV2(address);
            //console.log('Retrieved kyc status from api in ' + (new Date() - startTime) + ' for ' + address + ': ' + kyc);
            //this._wallets.set(addressLc, kyc);
            return false;
        }
    }

    async _isKycApiV2(address) {
        const url = 'https://api.otherside.xyz/proofs/' + address;
        const req = {
            headers: {
                'pragma': 'no-cache',
                'cache-control': 'no-cache',
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36',
                'sec-gpc': '1',
                'origin': 'https://kyc-api.animocabrands.com',
                'sec-fetch-site': 'same-site',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                'accept-language': 'en-US,en;q=0.9',
                'dnt': '1'
            },
            responseType: 'text',
            timeout: 12000,
            followRedirect: true,
            retry: 0
        };
        
        // Add proxy if there are any available
        const proxy = await this._nextProxy();
        if (proxy && proxy.host && proxy.port) {
            req.agent = {
                https: tunnel.httpsOverHttp({ proxy })
            };
        }

        try {
            const res = await got.get(url, req);
            return true;
        }
        catch (err) {
            if (err.message.includes('404')) {
                return false;
            }
            else {
                throw err;
            }
        }
    }

    async _isKycApiV1(address) {
        const url = 'https://kyc-api.animocabrands.com/v1.0/profile/?walletAddress=' + address;
        const req = {
            headers: {
                'pragma': 'no-cache',
                'cache-control': 'no-cache',
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36',
                'sec-gpc': '1',
                'origin': 'https://kyc-api.animocabrands.com',
                'sec-fetch-site': 'same-site',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                'accept-language': 'en-US,en;q=0.9',
                'dnt': '1'
            },
            responseType: 'json',
            timeout: 12000,
            followRedirect: true,
            retry: 0
        };
        
        // Add proxy if there are any available
        const proxy = await this._nextProxy();
        if (proxy && proxy.host && proxy.port) {
            req.agent = {
                https: tunnel.httpsOverHttp({ proxy })
            };
        }

        const res = await got.get(url, req);
        return res
            && res.body
            && res.body.status === 'APPROVED' 
            && res.body.info 
            && res.body.info.blockpass 
            && res.body.info.blockpass.status === 'success' 
            && res.body.info.blockpass.data
            && res.body.info.blockpass.data.status === 'approved';
    }

    async _nextProxy() {
        if (!this.useProxy) {
            return null;
        }
        const release = await this._proxyMutex.acquire();
        try {
            const proxy = this._proxies[this._proxyI];
            this._proxyI = (this._proxyI + 1) % this._proxies.length;
            return !proxy.username || !proxy.password ? 
                { host: proxy.host, port: proxy.port } : 
                { host: proxy.host, port: proxy.port, proxyAuth: proxy.username + ':' + proxy.password };
        }
        finally {
            release();
        }
    }
}

module.exports = KycManager;