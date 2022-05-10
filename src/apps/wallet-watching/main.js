const { streamFullBlocks } = require("../../utils");
const handleOpenseaSale = require('./opensea-sale');

async function main() {
    const handleBlock = async block => {
        console.log('Detected block ' + block.blockNumber + ' with ' + (block.transactions ? block.transactions.length : 0) + ' transactions');

        const tasks = [];
        if (block.transactions) {
            for (const tx of block.transactions) {
                tasks.push((async () => {
                    try {
                        await handleOpenseaSale(tx);
                    }
                    catch (err) {
                        console.log('Opensea sale handling failed for tx ' + tx.hash + ': ' + err.message);
                    }
                }));
            }
        }

        await Promise.all(tasks);
    };

    const close = await streamFullBlocks(handleBlock);
}

module.exports = main();