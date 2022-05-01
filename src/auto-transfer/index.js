const ethers = require('ethers');
const fs = require('fs').promises;
const got = require('got');

const CONFIGS = process.cwd() + '/src/auto-transfer/configs.json';
const TARGET_BAL = ethers.utils.parseEther('0.1');

async function main() {
    const { privateKey, endpoint, webhook, destination } = await readConfigs(CONFIGS);
    if (!privateKey) {
        throw new Error('Missing private key');
    }
    if (!endpoint) {
        throw new Error('Missing rpc endpoint');
    }
    if (!webhook) {
        throw new Error('Missing discord webhook');
    }
    if (!destination) {
        throw new Error('Missing destination');
    }

    const provider = new ethers.providers.JsonRpcProvider('https://' + endpoint);
    await provider.ready;
    console.log('Connected to provider!');

    const signer = new ethers.Wallet(privateKey, provider);

    while (true) {
        const balance = await signer.getBalance();
        console.log('Current balance is ' + ethers.utils.formatEther(balance));

        if (balance.gt(TARGET_BAL)) {
            try {
                console.log('Detected high balance');
                await notify({ 
                    title: 'Balance increased to ' + ethers.utils.formatEther(balance), 
                    url: 'https://etherscan.io/address/0x525B7D90e43ee292348B9E3a0adC8376d8c9998B',
                    webhook: webhook,
                });
            }
            catch (err) {
                console.log('Failed to send discord notification: ' + err.message);
                continue;
            }

            const tx = await getTx(signer, provider, destination, balance);
            if (!tx) {
                continue;
            }

            console.log('Max = ' + ethers.utils.formatUnits(tx.maxFeePerGas, 'gwei'));
            console.log('Prio = ' + ethers.utils.formatUnits(tx.maxPriorityFeePerGas, 'gwei'));
            console.log('Transferring ' + ethers.utils.formatEther(tx.value));

            try {
                await provider.call(tx, 'latest');
                console.log('Successfully sent transaction');
                const receipt = await signer.sendTransaction(tx);
                const txHash = receipt.transactionHash;
                await notify({ 
                    title: 'Auto-transfered refund!', 
                    url: 'https://etherscan.io/tx/' + txHash,
                    webhook,
                });
            }
            catch (err) {
                const txHash = err.receipt && err.receipt.transactionHash;
                console.log('Failed to send transaction: ' + err.message);
                await notify({ 
                    title: 'Failed to auto-transfer!', 
                    url: 'https://etherscan.io/tx/' + txHash,
                    webhook
                });
            }
            break;
        }
        await sleep(1000);
    }
}

async function readConfigs(path) {
    try {
        return JSON.parse(await fs.readFile(path));
    }
    catch (err) {
        throw new Error('Failed to read configs at \'' + path + '\': ' + err.message);
    }
}

async function getTx(signer, provider, destination, balance) {
    try {
        const [nonce, maxFee] = await Promise.all([
            signer.getTransactionCount(),
            getMaxFee(provider),
        ]);
    
        const gasLimit = 21000;
        const fees = maxFee.mul(gasLimit);
        if (balance.lte(fees)) {
            console.log('Balance is less than fees');
            return null;
        }
        const value = balance.sub(fees);
    
        const tx = {
            to: destination,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: ethers.utils.parseUnits('3', 'gwei'),
            gasLimit,
            value,
            type: 2,
            data: '0x',
            chainId: 1,
            nonce: nonce,
        };
    
        return tx;
    }
    catch (err) {
        console.log('Failed to create tx: ' + err.message);
        return null;
    }
}

async function getMaxFee(provider) {
    if (!provider) {
        throw new Error('Missing provider');
    }
    const block = await provider.getBlock('latest');
    return block && block.baseFeePerGas.mul(3).div(2);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function notify(props = {}) {
    const { title, url, webhook, description } = props;
    if (!webhook) {
        throw new Error('Missing webhook');
    }
    if (!title) {
        throw new Error('Missing title');
    }

    const payload = {
        embeds: [{
            title,
            url: url || undefined,
            description: description || undefined,
        }]
    };

    await got.post(webhook, {
        json: payload,
        timeout: 5000,
        retry: {
            calculateDelay: ({ attemptCount, error }) => {
                if (attemptCount >= 2) return 0; // max attempts
                else if (error.response != null && error.response.statusCode === 429) return JSON.parse(error.response.body).retry_after; // rate limit
                else if (error instanceof got.TimeoutError) return 100; // timeout
                else return 0; // stop
            }
        }
    });
}

main().catch(console.log);