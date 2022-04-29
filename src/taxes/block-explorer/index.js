const fs = require('fs').promises;
const csvToJson = require('csvtojson');
const ethers = require('ethers');
const { Transaction, TokenTransaction } = require('./csv/txs');

async function group(regDir, erc20Dir, erc721Dir, erc1155Dir) {
    const txs = new Map();
    const recordTx = tx => {
        if (!txs.has(tx.hash)) {
            txs.set(tx.hash, tx);
        }
    }

    // Group regular transactions
    if (regDir) {
        const paths = (await fs.readdir(regDir)).map(f => regDir + '/' + f);
        for (const path of paths) {
            console.log('Adding regular transactions from ' + path);
            const txs = await readCsv(path);
            for (const tx of txs) {
                try {
                    recordTx(new Transaction(
                        tx.Txhash, 
                        tx.UnixTimestamp, 
                        tx.To, 
                        tx.From, 
                        tx.Method, 
                        tx.Status === '', 
                        ethers.utils.parseEther(tx['Value_OUT(ETH)'] !== '0' ? tx['Value_OUT(ETH)'] : tx['Value_IN(ETH)']), 
                        ethers.utils.parseEther(tx['TxnFee(ETH)']), 
                        tx['Historical $Price/Eth']
                    ));
                }
                catch (err) {
                    console.log(tx);
                    throw err;
                }
            }
        }
    }

    // Group erc20 transactions
    if (erc20Dir) {
        const paths = (await fs.readdir(erc20Dir)).map(f => erc20Dir + '/' + f);
        for (const path of paths) {
            console.log('Adding erc20 transactions from ' + path);
            const txs = await readCsv(path);
            for (const tx of txs) {
                try {
                    const desc = (tx.TokenName ? tx.TokenName + ' ' : '') + (tx.TokenSymbol ? '(' + tx.TokenSymbol + ') ' : '') + (tx.TokenId ? ' ' + tx.TokenId : '');
                    recordTx(new TokenTransaction(
                        tx.Txhash, 
                        tx.UnixTimestamp, 
                        tx.To, 
                        tx.From, 
                        desc,
                        tx.Value || '1',
                    ));
                }
                catch (err) {
                    console.log(tx);
                    throw err;
                }
            }
        }
    }

    // Group erc721 transactions
    if (erc721Dir) {
        const paths = (await fs.readdir(erc721Dir)).map(f => erc721Dir + '/' + f);
        for (const path of paths) {
            console.log('Adding erc721 transactions from ' + path);
            const txs = await readCsv(path);
            for (const tx of txs) {
                try {
                    const desc = (tx.TokenName ? tx.TokenName + ' ' : '') + (tx.TokenSymbol ? '(' + tx.TokenSymbol + ') ' : '') + (tx.TokenId ? ' ' + tx.TokenId : '');
                    recordTx(new TokenTransaction(
                        tx.Txhash, 
                        tx.UnixTimestamp, 
                        tx.To, 
                        tx.From, 
                        desc,
                        tx.Value || '1',
                    ));
                }
                catch (err) {
                    console.log(tx);
                    throw err;
                }
            }
        }
    }

    // Group erc1155 transactions
    if (erc1155Dir) {
        const paths = (await fs.readdir(erc1155Dir)).map(f => erc1155Dir + '/' + f);
        for (const path of paths) {
            console.log('Adding erc1155 transactions from ' + path);
            const txs = await readCsv(path);            
            for (const tx of txs) {
                try {
                    const desc = (tx.TokenSymbol ? tx.TokenSymbol + ' ' : '') + (tx.field10 ? '(' + tx.field10 + ') ' : '') + (tx.TokenId ? ' ' + tx.TokenId : '');
                    recordTx(new TokenTransaction(
                        tx.Txhash, 
                        tx.UnixTimestamp,
                        tx.To, 
                        tx.From, 
                        desc,
                        tx.TokenName || '1',
                    ));
                }
                catch (err) {
                    console.log(tx);
                    throw err;
                }
            }
        }
    }

    return Array.from(txs.values());
}

// Returns array of csv lines
async function readCsv(path) {
    if (!path) {
        throw new Error('Missing path');
    }
    return await csvToJson({ trim: true }).fromFile(path);
}

function detectWriteoffs(txs) {
    const knownDescs = [
        'transfer',
        'transfer from',
        'register proxy',
        'atomic match_',
        'set approval for all',
        'cancel order_',
        'place bid',
        'stake by ids',
        'unstake by ids',
        'approve',
        'multicall',
        'deposit eth'
    ];

    const excludeTxs = [
        '0x884225b3632389a12d4b3b75d92927e6018e2b24a5f6607e297551819e8442a5'
    ];

    for (const tx of txs) {
        if (!tx.status ||
            excludeTxs.includes(tx.hash) ||
            // tx.value && tx.value.eq(ethers.BigNumber.from(0)) ||
            knownDescs.includes(tx.description)) {
            tx.markAsWriteoff();
        }
    }
}

function sort(txs) {
    return txs.sort((a,b) => a.ts - b.ts);
}

function updateEthPrice(txs) {
    let lastEthPrice = null;
    for (const tx of txs) {
        if (!tx.ethPrice) {
            if (!lastEthPrice) {
                throw new Error('First tx missing eth price');
            }
            tx.ethPrice = lastEthPrice;
        }
        else {
            lastEthPrice = tx.ethPrice;
        }
    }
}

async function updateCosts(provider, txs) {
    let tasks = [];
    for (const tx of txs) {
        if (tx instanceof TokenTransaction) {
            tasks.push(tx.updateCost(provider));
        }
        if (tasks.length > 40) {
            console.log('Updating costs for ' + tasks.length + ' txs');
            await Promise.all(tasks);
            tasks = [];
        }
    }
    if (tasks.length > 0) {
        console.log('Updating costs for ' + tasks.length + ' txs');
        await Promise.all(tasks);
    }
}

function printSummary(autoTxs, manualTxs) {
    console.log('Total: ' + (autoTxs.length + manualTxs.length));
    console.log('Need manual: ' + manualTxs.length);

    let writeOffFees = ethers.BigNumber.from(0);
    for (const tx of autoTxs) {
        if (tx.fees == null) {
            console.log(tx);
            throw new Error('Transaction missing fees');
        }
        writeOffFees = writeOffFees.add(ethers.utils.parseEther(tx.fees));
    }

    console.log('Writeoff fees: ' + ethers.utils.formatEther(writeOffFees));
}

async function writeJson(path, txs) {
    await fs.writeFile(path, JSON.stringify(txs, null, 2));
}

async function writeCsv(path, txs) {
    let csv = 'description,date_acquired,date_sold,proceeds($),cost_basis($),gain_or_loss($),_hash,_description,_quantity,_cost($),_value($),_fees($),_eth_price($)\n';
    txs = txs.filter(tx => !tx.isWriteoff);
    for (const tx of txs) {
        csv += '"","","' + 
            tx.ts.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }).split(', ')[0] + '","","","","' + 
            tx.hash + '","' +
            tx.description + '","' +
            (tx.tokenAmount || 1) + '","' +
            round(tx.cost) + '","' +
            round(tx.value) + '","' +
            round(tx.fees) + '","' +
            round(tx.ethPrice) + '"\n';

    }
    await fs.writeFile(path, csv);
}

function round(dollars) {
    return Math.round(dollars * 100) / 100;
}

async function main() {
    const provider = new ethers.providers.WebSocketProvider('wss://eth-mainnet.alchemyapi.io/v2/_lXNVI-yluBd4gZadFNQj9LTPnKEOWW5');
    const root = process.cwd();
    const txs = await group(
        root + '/src/block-explorer/csv/regular',
        root + '/src/block-explorer/csv/erc20',
        root + '/src/block-explorer/csv/erc721',
        root + '/src/block-explorer/csv/erc1155'
    );

    sort(txs);

    detectWriteoffs(txs);
    const autoTxs = txs.filter(tx => tx.isWriteoff);
    const manualTxs = txs.filter(tx => !tx.isWriteoff);
    updateEthPrice(txs);
    await updateCosts(provider, txs);

    await writeJson(root + '/src/block-explorer/csv/out/manual.json', manualTxs);
    await writeJson(root + '/src/block-explorer/csv/out/auto.json', autoTxs);
    await writeCsv(root + '/src/block-explorer/csv/out/manual.csv', manualTxs);
    await writeCsv(root + '/src/block-explorer/csv/out/auto.csv', autoTxs);
    printSummary(autoTxs, manualTxs);

    await provider.destroy();
}

main().catch(console.log);