const ethers = require('ethers');
const { Client, Intents } = require('discord.js');
const { notify } = require('../../utils');
const { Token } = require('./objects');

class DiscordController {
    constructor(channelName, discordKey, auth, farmingController, signerManager, policyManager) {
        if (!channelName) {
            throw new Error('Missing channel name');
        }
        if (!discordKey) {
            throw new Error('Missing discord token');
        }
        if (!auth) {
            throw new Error('Missing auth profiles');
        }
        if (!auth.admin) {
            throw new Error('Missing auth admin');
        }
        if (!farmingController) {
            throw new Error('Missing farming controller');
        }
        if (!signerManager) {
            throw new Error('Missing signer manager');
        }
        if (!policyManager) {
            throw new Error('Missing policy manager');
        }

        this._channelName = channelName.toLowerCase();
        this._token = discordKey;
        this._client;
        this._fc = farmingController;
        this._sm = signerManager;
        this._pm = policyManager;
        this._authAdmin = auth.admin;
        this._auth = new Map();
        for (const [name, discordId] of Object.entries(auth)) {
            if (name !== 'admin') {
                this._auth.set(discordId, name.toLowerCase());
                console.log('Added auth profile for ' + name);
            }
        }
    }

    async start() {
        if (this._client) {
            return;
        }

        // Create discord client
        this._client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
        this._client.once('ready', async () => {
            console.log('Started server, listening to ' + this._channelName);
            await notify('Ready to cuck!');
        });
        this._client.login(this._token);

        this._client.on('messageCreate', async cursor => {
            if (cursor.author.bot || cursor.channel.name !== this._channelName) {
                return;
            }

            const discordId = cursor.author.id.toString();
            if (discordId !== this._authAdmin && !this._auth.has(discordId)) {
                cursor.reply('Unauthorized, cuck!');
                return;
            }

            const lines = cursor.content.split(/[\r?\n]+/).filter(line => line !== '');
            if (lines.length === 0) {
                cursor.reply('No valid commands found, cuck!');
                return;
            }

            const args = lines[0].split(/[\s]+/).filter(kw => kw !== '');
            if (args.length === 0) {
                cursor.reply('This shouldn\'t even be possible!');
                return;
            }
            const command = args[0].toLowerCase();

            try {
                switch (command) {
                    case 'users': {
                        const users = this._sm.names;
                        let message = users[0];
                        for (let i = 1; i < users.length; ++i) {
                            message += ', ' + users[i];
                        }
                        cursor.reply(message || 'No users found');
                        break;
                    };
                    case 'policies': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        let message;
                        if (user) {
                            const address = this._sm.getAddress(user);
                            message = this._formatPolicies(this._pm.policies.filter(p => p.user === address));
                        }
                        else {
                            message = this._formatPolicies(this._pm.policies);
                        }
                        cursor.reply(message || 'No policies found');
                        break;
                    }
                    case 'add': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        this._authenticate(user, discordId);
                        const token = new Token(args[2], args[3]);
                        const insurance = args[4] ? args[4].toLowerCase() : null;
                        if (!insurance) {
                            throw new Error('Missing insurance (eth)');
                        }
                        await this._pm.add(this._sm.getAddress(user), token, ethers.utils.parseEther(insurance));
                        await this._pm.save();
                        const address = this._sm.getAddress(user);
                        const message = this._formatPolicies(this._pm.policies.filter(p => p.user === address));
                        cursor.reply('Successfully added policy' + (message ? '\n' + message : ''));
                        break;
                    }
                    case 'remove': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        this._authenticate(user, discordId);
                        const token = new Token(args[2], args[3]);
                        await this._pm.remove(token);
                        await this._pm.save();
                        const address = this._sm.getAddress(user);
                        const message = this._formatPolicies(this._pm.policies.filter(p => p.user === address));
                        cursor.reply('Successfully removed policy' + (message ? '\n' + message : ''));
                        break;
                    }
                    case 'help': 
                    default: {
                        cursor.reply(this._printUsage());
                    }
                }
            }
            catch (err) {
                cursor.reply('Error: ' + err.message + '\n' + this._printUsage());
                console.log('Error: ' + err.message);
                console.log(err.stack);
            } 
        });
    }

    _authenticate(user, discordId) {
        if (user && discordId !== this._authAdmin && user !== this._auth.get(discordId)) {
            throw new Error('Not authorized to modify this user... cuck!');
        }
    }

    _printUsage() {
        return 'Usage:\n' +
        '  users\n' +
        '  policies <user>\n' +
        '  add <user> <tokenContract> <tokenId> <insurance (eth)>\n' +
        '  remove <user> <tokenContract> <tokenId>';
    }

    _formatPolicies(policies) {
        if (!Array.isArray(policies)) {
            throw new Error('Missing policies');
        }
        if (policies.length > 0) {
            const formatPolicy = p => {
                const name = this._sm.getName(p.user);
                return name + ' ' + p.token.address + ' ' + p.token.id + ' ' + '[insured for ' + ethers.utils.formatEther(p.insurance) + 'Ξ] [' + (p.running ? 'ACTIVE' : 'INACTIVE') + ']';
            }
            let str = formatPolicy(policies[0]);
            for (let i = 1; i < policies.length; ++i) {
                str += '\n' + formatPolicy(policies[i]);
            }
            return str;
        }

        return '';
    }

    async stop() {
        if (this._client) {
            const client = this._client;
            this._client = null;
            await client.stop();
        }
    }
}

module.exports = DiscordController;