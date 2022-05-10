const { Client, Intents } = require('discord.js');
const { notify } = require('../../utils');

class DiscordController {
    constructor(discordKey, auth, looksEnsurer) {
        if (!discordKey) {
            throw new Error('Missing discord token');
        }
        if (!auth) {
            throw new Error('Missing auth profiles');
        }
        if (!auth.admin) {
            throw new Error('Missing auth admin');
        }
        if (!looksEnsurer) {
            throw new Error('Missing looks ensurer');
        }

        this._token = discordKey;
        this._client;
        this._le = looksEnsurer;
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
            await notify('Ready to cuck!');
        });
        this._client.login(this._token);

        this._client.on('messageCreate', async cursor => {
            if (cursor.author.bot || !cursor.channel.name.includes('looks')) {
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
                        const users = this._le.signers;
                        let str = users[0];
                        for (let i = 1; i < users.length; ++i) {
                            str += ', ' + users[i];
                        }
                        if (str) {
                            cursor.reply(str);
                        }
                        else {
                            cursor.reply('No users found');
                        }
                        break;
                    };
                    case 'policies': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        let message;
                        if (user) {
                            message = this._formatPolicies(this._le.policies.filter(p => p.owner === user.toLowerCase()));
                        }
                        else {
                            message = this._formatPolicies(this._le.policies);
                        }
                        if (message) {
                            cursor.reply(message);
                        }
                        else {
                            cursor.reply('No policies found');
                        }
                        break;
                    }
                    case 'add': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        this._authenticate(user, discordId);
                        const tokenContract = args[2] ? args[2].toLowerCase() : null;
                        const tokenId = args[3] ? args[3].toLowerCase() : null;
                        const maxInsurance = args[4] ? args[4].toLowerCase() : null;
                        await this._le.addPolicy(user, tokenContract, tokenId, maxInsurance);
                        const message = this._formatPolicies(this._le.policies.filter(p => p.owner === user.toLowerCase()));
                        if (message) {
                            cursor.reply(message);
                        }
                        break;
                    }
                    case 'remove': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        this._authenticate(user, discordId);
                        const tokenContract = args[2] ? args[2].toLowerCase() : null;
                        const tokenId = args[3] ? args[3].toLowerCase() : null;
                        await this._le.removePolicy(user, tokenContract, tokenId);
                        const message = this._formatPolicies(this._le.policies.filter(p => p.owner === user.toLowerCase()));
                        if (message) {
                            cursor.reply('Successfully removed policy\n' + message);
                        }
                        else {
                            cursor.reply('Successfully removed policy');
                        }
                        break;
                    }
                    case 'help': 
                    default: {
                        cursor.reply(this._printUsage());
                    }
                }
            }
            catch (err) {
                cursor.reply('Encountered error: ' + err.message + '\n' + this._printUsage());
                console.log('Encountered error: ' + err.message);
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
                return p.owner + ' ' + p.tokenContract + ' ' + p.tokenId + ' ' + '[insured for ' + ethers.utils.formatEther(p.maxInsurance) + 'Ξ] [' + (p.running ? 'RUNNING' : 'STOPPED') + ']';
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