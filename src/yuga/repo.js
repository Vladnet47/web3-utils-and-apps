const mongoose = require('mongoose');
const { Mongo, SchemaType } = require('db-schemas');

async function open(host, port, database, username, password) {
    if (!database) throw new Error('Database host, port or table not specified');

    const url = Mongo.toUrl(host, port, database);

    // Log connection events
    // https://mongoosejs.com/docs/api/connection.html#connection_Connection-readyState
    mongoose.connection.on('connected', () => console.log('Database connected to ' + url));
    mongoose.connection.on('disconnected', () => console.log('Database disconnected'));
    mongoose.connection.on('error', err => console.log('Database encountered error: ' + err.message));

    // Make initial connection. Don't throw error because it likely means wrong connection url. In the unlikely event that container
    // starts while mongo is down, container will keep restarting until mongo is back up.
    while (mongoose.connection.readyState !== 1) {
        try {
            await mongoose.connect(url, Mongo.getOpts(username, password, 4));
        }
        catch (err) {
            console.log('Databased failed on initial connect: ' + err.message);
            await sleep(5000);
            continue;
        }
    }

    // Populate with models
    Mongo.hydrate(mongoose.connection, true);
}

async function close() {
    mongoose.connection.removeAllListeners();
    await mongoose.connection.close();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getProxies() {
    return await Mongo.findMany(null, mongoose.connection, SchemaType.PROXY, {}, 'host port username password');
}

module.exports = {
    open,
    close,
    getProxies
};