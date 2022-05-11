const { Mutex } = require('async-mutex');
const got = require('got');
const tunnel = require('tunnel');
const mongo = require('../mongo');

class HttpRequests {
    constructor(useProxy) {
        this._useProxy = useProxy === true;
        this._proxies = [];
        this._proxyMutex = new Mutex();
        this._proxyI = 0;
        this._loaded = false;
    }

    async load() {
        if (this._useProxy && !this._loaded) {
            this._proxies = await mongo.readProxies();
            this._loaded = true;
            console.log('Loaded ' + this._proxies.length + ' proxies');
        }
    }

    async get(url, headers, type, timeout) {
        if (!url) {
            throw new Error('Missing url');
        }
        if (!headers) {
            headers = this._defaultHeaders();
        }
        if (!type) {
            type === 'json';
        }
        if (!timeout) {
            timeout = 5000;
        }
    
        const req = {
            headers,
            responseType: type,
            timeout,
            followRedirect: true,
            retry: 0
        };
        
        const proxy = await this._nextProxy();
        if (proxy) {
            req.agent = { https: tunnel.httpsOverHttp({ proxy }) };
        }
    
        const res = await got.get(url, req);
        return res.body;
    }

    async post(url, body, headers, type, timeout) {
        if (!url) {
            throw new Error('Missing url');
        }
        if (!body) {
            body = {};
        }
        if (!headers) {
            headers = this._defaultHeaders();
        }
        if (!type) {
            type === 'json';
        }
        if (!timeout) {
            timeout = 5000;
        }
    
        const req = {
            headers,
            responseType: type,
            json: body,
            timeout,
            followRedirect: true,
            retry: 0
        };
        
        const proxy = await this._nextProxy();
        if (proxy) {
            req.agent = { https: tunnel.httpsOverHttp({ proxy }) };
        }
    
        const res = await got.post(url, req);
        return res.body;
    }

    _defaultHeaders() {
        return {
            'pragma': 'no-cache',
            'cache-control': 'no-cache',
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36',
            'sec-gpc': '1',
            'sec-fetch-site': 'same-site',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'accept-language': 'en-US,en;q=0.9',
            'dnt': '1'
        };
    }

    async _nextProxy() {
        const release = await this._proxyMutex.acquire();
        try {
            await this.load();
            if (!this._useProxy || this._proxies.length === 0) {
                return null;
            }
            const proxy = this._proxies[this._proxyI];
            this._proxyI = (this._proxyI + 1) % this._proxies.length;
            return this._formatProxy(proxy);
        }
        finally {
            release();
        }
    }
    
    _formatProxy(proxy) {
        if (!proxy || !proxy.host || !proxy.port) {
            throw new Error('Missing proxy host or port');
        }
        return !proxy.username || !proxy.password ? 
            { host: proxy.host, port: proxy.port } : 
            { host: proxy.host, port: proxy.port, proxyAuth: proxy.username + ':' + proxy.password };
    }
}

module.exports = HttpRequests;