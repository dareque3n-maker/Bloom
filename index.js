const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
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

// 1. Load Commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }
}

// 2. Bot Ready & Slash Commands Registration
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);

    // Connect MongoDB
    if (process.env.MONGO_URI) {
        try {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('✅ Connected to MongoDB Database');
        } catch (err) {
            console.error('❌ Database Connection Error:', err);
        }
    }

    // Register Slash Commands globally
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('✅ Successfully registered Slash (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// 3. Interaction Router (Commands, Buttons & Modals)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        }
    } 
    else if (interaction.isButton() || interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('setup_') || interaction.customId.startsWith('modal_')) {
            const { handleCommunityInteractions } = require('./handlers/communityHandler');
            await handleCommunityInteractions(interaction);
        }
    }
});

// 4. Welcome & Goodbye Events
const GuildConfig = require('./models/GuildConfig');
const { EmbedBuilder } = require('discord.js');

client.on('guildMemberAdd', async member => {
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!config || !config.welcomeChannel) return;

    const channel = member.guild.channels.cache.get(config.welcomeChannel);
    if (!channel) return;

    let msg = config.welcomeMessage || 'Welcome {user}!';
    msg = msg
        .replace(/{user}/g, `${member}`)
        .replace(/{memberCount}/g, member.guild.memberCount)
        .replace(/{accountCreate}/g, `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`);

    const embed = new EmbedBuilder()
        .setDescription(msg)
        .setColor('#00FFCC')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    if (config.welcomeThumbnail) embed.setImage(config.welcomeThumbnail);

    channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

client.on('guildMemberRemove', async member => {
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!config || !config.goodbyeChannel) return;

    const channel = member.guild.channels.cache.get(config.goodbyeChannel);
    if (!channel) return;

    let msg = config.goodbyeMessage || '{user} has left.';
    msg = msg
        .replace(/{user}/g, `${member.user.tag}`)
        .replace(/{accountLefted}/g, `<t:${Math.floor(Date.now() / 1000)}:R>`);

    const embed = new EmbedBuilder()
        .setDescription(msg)
        .setColor('#FF0000')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
});

// 5. Auto Response Event
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const text = message.content.toLowerCase();
    const config = await GuildConfig.findOne({ guildId: message.guild.id });
    if (!config || !config.autoResponses) return;

    const matched = config.autoResponses.find(r => text.includes(r.trigger));
    if (matched && matched.replyText) {
        await message.reply(matched.replyText);
    }
});

// Login Bot
client.login(process.env.DISCORD_TOKEN);
