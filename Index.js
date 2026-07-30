const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

client.commands = new Collection();

// Bot Ready Event
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB Database');
}).catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
});

// Login Bot
client.login(process.env.DISCORD_TOKEN);
