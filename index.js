const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();
const commands = [];

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }
}

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    if (process.env.MONGO_URI) {
        try { await mongoose.connect(process.env.MONGO_URI); console.log('✅ Connected to MongoDB'); } catch (e) { console.error(e); }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Slash Commands Registered.');
    } catch (e) { console.error(e); }
});

// Interaction Dispatcher
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (cmd) await cmd.execute(interaction).catch(console.error);
    } 
    else if (interaction.isButton() || interaction.isModalSubmit()) {
        const { handleManagementInteractions } = require('./handlers/managementHandler');
        await handleManagementInteractions(interaction);
    }
});

// Community Events (Welcome & Goodbye)
const { GuildConfig } = require('./models/GuildConfig');

client.on('guildMemberAdd', async member => {
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!config || !config.welcomeChannel) return;
    const channel = member.guild.channels.cache.get(config.welcomeChannel);
    if (!channel) return;

    let msg = config.welcomeMessage || 'Welcome {user}!';
    msg = msg
        .replace(/{user}/g, `${member}`)
        .replace(/{memberCount}/g, member.guild.memberCount)
        .replace(/{accountCreate}/g, `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
        .replace(/{memberJoined}/g, `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`);

    const embed = new EmbedBuilder().setDescription(msg).setColor('#00FFCC').setThumbnail(member.user.displayAvatarURL({ dynamic: true })).setTimestamp();
    if (config.welcomeThumbnail) embed.setImage(config.welcomeThumbnail);
    channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

client.on('guildMemberRemove', async member => {
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!config || !config.goodbyeChannel) return;
    const channel = member.guild.channels.cache.get(config.goodbyeChannel);
    if (!channel) return;

    let msg = config.goodbyeMessage || '{user} has left.';
    msg = msg.replace(/{user}/g, `${member.user.tag}`).replace(/{accountLefted}/g, `<t:${Math.floor(Date.now() / 1000)}:R>`);

    const embed = new EmbedBuilder().setDescription(msg).setColor('#FF0000').setThumbnail(member.user.displayAvatarURL({ dynamic: true })).setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
});

// Auto Response Event (Embed & Image Support)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    const text = message.content.toLowerCase();
    const config = await GuildConfig.findOne({ guildId: message.guild.id });
    if (!config || !config.autoResponses) return;

    const matched = config.autoResponses.find(r => new RegExp(`\\b${r.trigger}\\b`, 'i').test(text));
    if (matched && matched.replyText) {
        let replyText = matched.replyText.replace(/\\n/g, '\n');
        const embed = new EmbedBuilder().setColor("Blue").setTimestamp();
        const urls = replyText.match(/(https?:\/\/[^\s]+)/g);
        if (urls) {
            const img = urls.find(u => u.match(/\.(jpeg|jpg|gif|png|webp)$/i));
            if (img) { embed.setImage(img); replyText = replyText.replace(img, '').trim(); }
        }
        if (replyText) embed.setDescription(replyText);
        return message.reply({ embeds: [embed] });
    }
});

client.login(process.env.DISCORD_TOKEN);
