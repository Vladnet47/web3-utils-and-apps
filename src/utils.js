const fs = require('fs').promises;

// Reads and returns json file at provided location relative to project data directory
async function readJson(path) {
    if (!path) {
        throw new Error('Missing path');
    }
    return JSON.parse(await fs.readFile(path));
}

async function writeJson(path, json) {
    await writeFile(path, JSON.stringify(json, null, 4));
}

async function writeFile(path, data) {
    if (!path || !data) {
        throw new Error('Missing path or data');
    }
    await fs.writeFile(path, data);
}

function isNumeric(str) {
    if (str == null) return false;
    str = str.toString();
    return !isNaN(str) && !isNaN(parseFloat(str));
}

function tsToString(unixTs){
    if (unixTs == null || unixTs === '') {
        throw new Error('Invalid unix timestamp');
    }
    const a = new Date(parseInt(unixTs) * 1000);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const year = a.getUTCFullYear();
    const month = months[a.getUTCMonth()];
    const date = a.getUTCDate();
    const hour = a.getUTCHours();
    const min = a.getUTCMinutes();
    const sec = a.getUTCSeconds();
    const time = month + ' ' + date + ' ' + year + ' ' + hour + ':' + min + ':' + sec + ' UTC';
    return time;
}

module.exports = {
    readJson,
    writeJson,
    writeFile,
    isNumeric,
    tsToString
};