
// Returns UTC current time, formatted as a string to 'seconds' precision
function ts() {
    return new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZone: 'UTC'});
}

// Sleeps given thread for specified number of milliseconds
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Returns true if value is numeric
function isNumeric(value) {
    return value != null && !value.startsWith('0x') && !isNaN(parseFloat(value)) && isFinite(value);
}

async function runInBatches(tasks, maxConcurrent) {
    if (!Array.isArray(tasks)) {
        throw new Error('Missing tasks');
    }
    maxConcurrent = maxConcurrent || 100;

    let batch = [];
    for (const task of tasks) {
        if (batch.length === maxConcurrent) {
            await Promise.all(batch);
            batch = [];
            console.log('Ran batch of ' + maxConcurrent + ' tasks');
        }

        batch.push((async () => {
            try {
                await task();
            }
            catch (err) {
                console.log('Failed to run task: ' + err.message);
            }
        })());
    }

    if (batch.length > 0) {
        await Promise.all(batch);
    }
}

function parseCmds() {
    const cmds = process.argv.slice(2);
    const r = {};
    for (const cmd of cmds) {
        if (!cmd.startsWith('--')) {
            throw new Error('Command arg must start with \'--\': ' + cmd);
        }
        if (cmd.includes('=')) {
            const split = cmd.split('=');
            if (split.length > 2) {
                throw new Error('Invalid command arg \'' + cmd + '\'');
            }
            const name = split[0].substring(2);
            const value = isNumeric(split[1]) ? parseFloat(split[1]) : split[1] === 'true' ? true : split[1] === 'false' ? false : split[1];
            r[name] = value;
        }
        else {
            const name = cmd.substring(2);
            r[name] = true;
        }
    }
    return r;
}

module.exports = {
    ts,
    sleep,
    isNumeric,
    parseCmds,
    runInBatches,
};