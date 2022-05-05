const mongoose = require('mongoose');
const { Mongo, SchemaType } = require('db-schemas');
const file = require('./file');
const common = require('./common');

async function readProxies() {
    const { database } = await file.readConfigs();
    await open(database.host, database.port, database.database, database.username, database.password);
    const proxies = await Mongo.findMany(null, mongoose.connection, SchemaType.PROXY, {}, 'host port username password'); 
    await close();
    return proxies;
}

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
            console.log('Failed to connect to database: ' + err.message);
            await common.sleep(5000);
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

module.exports = {
    readProxies,
};