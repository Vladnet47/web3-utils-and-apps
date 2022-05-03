const fs = require('fs').promises;
const csvToJson = require('csvtojson');

async function readJson(path) {
    if (!path) {
        throw new Error('Missing path to file');
    }
    if (!path.endsWith('.json')) {
        throw new Error('Path must end with .json');
    }
    return JSON.parse((await fs.readFile(path)).toString());
}

async function writeJson(path, f) {
    if (!path) {
        throw new Error('Missing path to file');
    }
    if (!path.endsWith('.json')) {
        throw new Error('Path must end with .json');
    }
    await fs.writeFile(JSON.stringify(f, null, 2));
}

async function readCsv(path) {
    if (!path) {
        throw new Error('Missing path to file');
    }
    if (!path.endsWith('.csv')) {
        throw new Error('Path must end with .csv');
    }
    return await csvToJson({ trim: true }).fromFile(path);
}

async function writeCsv(path, f) {
    if (!path) {
        throw new Error('Missing path to file');
    }
    if (!path.endsWith('.csv')) {
        throw new Error('Path must end with .csv');
    }
    if (!f) {
        throw new Error('Missing csv data to write');
    }
    await fs.writeFile(f.toString());
}

async function existsFile(path) {
    if (!path) {
        throw new Error('Missing path to file');
    }
    try {
        await fs.access(path);
        return true;
    }
    catch (err) {
        return false;
    }
}

async function readDefaultConfigs() {
    return await readJson(__dirname + '/default-configs.json');
}

module.exports = {
    readJson,
    writeJson,
    readCsv,
    writeCsv,
    existsFile,
    readDefaultConfigs,
};