const ethers = require('ethers');
const { Client, Intents } = require('discord.js');
const { notify } = require('../../utils');
const { Token, CancelPolicy, ListingPolicy } = require('./objects');

class DiscordController {
    constructor(channelName, discordKey, auth, farmingController, signerManager, cancelManager, listingManager) {
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
        if (!cancelManager) {
            throw new Error('Missing cancel policy manager');
        }
        if (!listingManager) {
            throw new Error('Missing listing policy manager');
        }

        this._channelName = channelName.toLowerCase();
        this._token = discordKey;
        this._client;
        this._fc = farmingController;
        this._sm = signerManager;
        this._cm = cancelManager;
        this._lm = listingManager;
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
                    case 'policies': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        cursor.reply(user ? { embeds: [this._getUserPolicyEmbeds(user)] } : this._getAllPolicyEmbeds());
                        break;
                    }
                    case 'addcancel': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        this._authenticate(user, discordId);
                        const token = new Token(args[2], args[3]);
                        const insurance = args[4] ? args[4].toLowerCase() : null;
                        if (!insurance) {
                            throw new Error('Missing insurance (eth)');
                        }
                        await this._cm.addPolicy(new CancelPolicy(this._sm.getAddress(user), token, ethers.utils.parseEther(insurance)));
                        await this._cm.save();
                        cursor.reply({ embeds: [this._getUserPolicyEmbeds(user)] });
                        break;
                    }
                    case 'removecancel': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        this._authenticate(user, discordId);
                        const token = new Token(args[2], args[3]);
                        await this._cm.removePolicy(token);
                        await this._cm.save();
                        cursor.reply({ embeds: [this._getUserPolicyEmbeds(user)] });
                        break;
                    }
                    case 'addlisting': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        this._authenticate(user, discordId);
                        const token = new Token(args[2], args[3]);
                        const percentage = args[4] ? parseInt(args[4]) : null;
                        const duration = args[5] ? parseInt(args[5]) * 1000 : null;
                        await this._lm.addPolicy(new ListingPolicy(this._sm.getAddress(user), token, percentage, duration));
                        await this._lm.save();
                        cursor.reply({ embeds: [this._getUserPolicyEmbeds(user)] });
                        break;
                    }
                    case 'removelisting': {
                        const user = args[1] ? args[1].toLowerCase() : null;
                        this._authenticate(user, discordId);
                        const token = new Token(args[2], args[3]);
                        await this._lm.removePolicy(token);
                        await this._lm.save();
                        cursor.reply({ embeds: [this._getUserPolicyEmbeds(user)] });
                        break;
                    }
                    case 'estop': {
                        console.log(this._auth.get(discordId) + ' executed emergency stop!');
                        process.exit(1);
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
        '  policies <user>\n' +
        '  addCancel <user> <tokenContract> <tokenId> <insurance (eth)>\n' +
        '  removeCancel <user> <tokenContract> <tokenId>\n' +
        '  addListing <user> <tokenContract> <tokenId> <percentage (above floor)> <duration (s)>\n' +
        '  removeListing <user> <tokenContract> <tokenId>\n' +
        '  estop';
    }

    _getAllPolicyEmbeds() {
        return {
            embeds: this._sm.names.map(u => this._getUserPolicyEmbeds(u))
        };
    }

    _getUserPolicyEmbeds(user) {
        if (!user) {
            throw new Error('Missing user');
        }
        const address = this._sm.getAddress(user);

        const cmPolicies = this._cm.policies.filter(p => p.user === address);
        let cmStr = '';
        for (const p of cmPolicies) {
            cmStr += '[**' + p.token.id + ' (...' + p.token.address.substring(p.token.address.length - 4) + ')**]' + 
                '(https://looksrare.org/collections/' + p.token.address + '/' + p.token.id + ') ' +
                '[ins=' + ethers.utils.formatEther(p.insurance) + 'Ξ]\n';
        }

        const lmPolicies = this._lm.policies.filter(p => p.user === address);
        let lmStr = '';
        for (const p of lmPolicies) {
            lmStr += '[**' + p.token.id + ' (...' + p.token.address.substring(p.token.address.length - 4) + ')**]' + 
                '(https://looksrare.org/collections/' + p.token.address + '/' + p.token.id + ') ' +
                '[per=' + p.targetPercentage + '%] ' +
                '[dur=' + (p.targetDuration / 1000 / 60) + 'min] ' + 
                '[price=' + (p.price ? ethers.utils.formatEther(p.price) + 'Ξ' : '') + ']\n'
        }

        const fields = [];
        if (cmStr) {
            fields.push({
                name: 'Auto-Cancels',
                value: cmStr,
                inline: false,
            });
        }
        if (lmStr) {
            fields.push({
                name: 'Auto-Listings',
                value: lmStr,
                inline: false
            });
        }

        const embed = {
            color: 0x0099ff,
            title: user.toLowerCase(),
            url: 'https://looksrare.org/accounts/' + address,
        };

        if (fields.length > 0) {
            embed.fields = fields;
        }

        return embed;
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