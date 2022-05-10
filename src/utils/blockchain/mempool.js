
// Continuously estimates whether tx would succeed on pending block before sending
async function sendOnPending(signer, tx) {
    if (!signer || !signer.isSigner) {
        throw new Error('Missing or invalid signer');
    }
    if (!tx) {
        throw new Error('Missing tx');
    }

    while (true) {
        try {
            await signer.call(tx, 'pending');
        }
        catch (err) {
            console.log('Tx would not succeed on pending block: ' + err.message);
            continue;
        }

        try {
            return await send(signer, tx);
        }
        catch (err) {
            console.log('Failed to send tx on pending block: ' + err.message);
            break;
        }
    }
}

// Continuously estimates whether tx would succeed on latest block before sending
async function sendOnLive(signer, tx) {
    if (!signer || !signer.isSigner) {
        throw new Error('Missing or invalid signer');
    }
    if (!tx) {
        throw new Error('Missing tx');
    }

    while (true) {
        try {
            await simulate(signer, tx);
        }
        catch (err) {
            console.log('Tx would not succeed on latest block: ' + err.message);
            continue;
        }

        try {
            return await send(signer, tx);
        }
        catch (err) {
            console.log('Failed to send tx on live block: ' + err.message);
            break;
        }
    }
}

// Sends provided tx
async function send(signer, tx) {
    if (!signer) {
        throw new Error('Missing signer');
    }
    if (!tx) {
        throw new Error('Missing tx');
    }
    try {
        const res = await signer.sendTransaction(tx);
        await res.wait();
        return true;
    }
    catch (err) {
        console.log(err.message);
        return false;
    }
}

// Simulates provided tx against latest block
async function simulate(provider, tx) {
    if (!provider) {
        throw new Error('Missing provider');
    }
    if (!tx) {
        throw new Error('Missing tx');
    }
    try {
        await provider.call(tx, 'latest');
        return true;
    }
    catch (err) {
        console.log(err.message);
        return false;
    }
}

module.exports = {
    sendOnPending,
    sendOnLive,
    send,
    simulate,
};