const mongoose = require('mongoose');
const file = require('./file');
const common = require('./common');

async function readProxies() {
    const { database } = await file.readConfigs();
    await open(database.host, database.port, database.database, database.username, database.password);
    const proxies = await mongoose.model('proxy').find({ suspended: false }).select('-_id host port username password').lean().exec();
    await close();
    return proxies;
}

async function open(host, port, database, username, password) {
    if (!host) {
        throw new Error('Missing database host');
    }
    if (!port) {
        throw new Error('Missing database port');
    }
    if (!database) {
        throw new Error('Missing database table');
    }
    const url = 'mongodb://' + host + ':' + port + '/' + database;

    // Log connection events
    // https://mongoosejs.com/docs/api/connection.html#connection_Connection-readyState
    mongoose.connection.on('connected', () => console.log('Database connected to ' + url));
    mongoose.connection.on('disconnected', () => console.log('Database disconnected'));
    mongoose.connection.on('error', err => console.log('Database encountered error: ' + err.message));

    // Make initial connection. Don't throw error because it likely means wrong connection url. In the unlikely event that container
    // starts while mongo is down, container will keep restarting until mongo is back up.
    while (mongoose.connection.readyState !== 1) {
        try {
            await mongoose.connect(url, {
                auth: (!username || !password) ? undefined : { user: username, password: password },
                keepAlive: false,
                maxPoolSize: 1,
            });
        }
        catch (err) {
            console.log('Failed to connect to database: ' + err.message);
            await common.sleep(5000);
            continue;
        }
    }

    mongoose.model('proxy', new mongoose.Schema({
        suspended: {
            type: Boolean,
            default: false,
        },
        host: { 
            type: String, 
            required: true 
        },
        port: { 
            type: Number, 
            required: true 
        },
        username: { 
            type: String, 
            required: true 
        },
        password: { 
            type: String, 
            required: true 
        }
    }, {
        id: false,
    }));
}

async function close() {
    mongoose.connection.removeAllListeners();
    await mongoose.connection.close();
}

module.exports = {
    readProxies,
};