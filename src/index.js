require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const DatabaseManager = require('./database/connection');
const { loadHandlers } = require('./handlers/index');
const CacheManager = require('./utils/CacheManager');
const SecurityEngine = require('./security/SecurityEngine');

class SecurityBot extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildBans,
                GatewayIntentBits.GuildEmojisAndStickers,
                GatewayIntentBits.GuildIntegrations,
                GatewayIntentBits.GuildWebhooks,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.AutoModerationConfiguration,
                GatewayIntentBits.AutoModerationExecution
            ],
            partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User, Partials.Reaction],
            allowedMentions: { parse: ['users', 'roles'], repliedUser: false }
        });

        this.commands = new Collection();
        this.slashCommands = new Collection();
        this.cooldowns = new Collection();
        this.cache = new CacheManager();
        this.security = new SecurityEngine(this);
    }

    async initialize() {
        try {
            await DatabaseManager.connect();
            await loadHandlers(this);
            await this.login(process.env.TOKEN);
        } catch (error) {
            console.error('Initialization Error:', error);
            process.exit(1);
        }
    }
}

const client = new SecurityBot();
client.initialize();

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

module.exports = client;
