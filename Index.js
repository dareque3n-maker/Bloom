require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder, ChannelType } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { GuildConfig, InviteData } = require('./models/GuildConfig');
const { GuildStore, OrderTicket } = require('./models/GuildStore');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ]
});

const guildInvites = new Map();
client.commands = new Collection();
const commandsArray = [];

const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(__dirname, 'commands', file));
    client.commands.set(command.data.name, command);
    commandsArray.push(command.data.toJSON());
}

client.once('ready', async () => {
    console.log(`🔥 ${client.user.tag} online and operational!`);
    if (process.env.MONGO_URI) {
        try { await mongoose.connect(process.env.MONGO_URI); } catch (err) { console.error("DB Error:", err); }
    }

    client.guilds.cache.forEach(async (guild) => {
        try {
            const invites = await guild.invites.fetch();
            const codeUses = new Map();
            invites.forEach(inv => codeUses.set(inv.code, inv.uses));
            guildInvites.set(guild.id, codeUses);
        } catch (e) {}
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commandsArray }); } catch (e) { console.error(e); }
});

// 1. Auto-Response & Invite Prefix Commands (!i, !lb)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Prefix invite commands
    if (message.content.startsWith('!i')) {
        const target = message.mentions.users.first() || message.author;
        const data = await InviteData.findOne({ guildId: message.guild.id, userId: target.id }) || { joins: 0, regular: 0, leaves: 0, fake: 0 };
        const net = data.regular - data.leaves - data.fake;
        return message.reply(`📊 **${target.username}** has **${net}** net invites (${data.joins} joins, ${data.leaves} leaves, ${data.fake} fake).`);
    }

    // Auto Response System
    try {
        const config = await GuildConfig.findOne({ guildId: message.guild.id });
        if (!config || !config.autoResponses) return;
        const matched = config.autoResponses.find(r => new RegExp(`\\b${r.trigger}\\b`, 'i').test(message.content.toLowerCase()));
        if (matched) return message.reply(matched.replyText);
    } catch (e) {}
});

// 2. Welcome & Real-Time Invite System
client.on('guildMemberAdd', async (member) => {
    try {
        const guildId = member.guild.id;
        const config = await GuildConfig.findOne({ guildId });

        // Welcome System
        if (config && config.welcomeChannel) {
            const channel = member.guild.channels.cache.get(config.welcomeChannel);
            if (channel) {
                let msg = config.welcomeMessage || 'Welcome to the server, {user}!';
                msg = msg.replace(/{user}/g, `${member}`).replace(/{memberCount}/g, `${member.guild.memberCount}`);
                const embed = new EmbedBuilder().setTitle(config.welcomeTitle || 'Welcome!').setDescription(msg).setColor('#FFCC00');
                await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
            }
        }

        // Invite Tracking Tracker
        const cached = guildInvites.get(guildId) || new Map();
        const newInvites = await member.guild.invites.fetch().catch(() => null);
        let inviter = null;
        if (newInvites) {
            const used = newInvites.find(inv => inv.uses > (cached.get(inv.code) || 0));
            if (used && used.inviter) inviter = used.inviter;

            const codeUses = new Map();
            newInvites.forEach(inv => codeUses.set(inv.code, inv.uses));
            guildInvites.set(guildId, codeUses);
        }

        if (inviter) {
            let invData = await InviteData.findOne({ guildId, userId: inviter.id }) || new InviteData({ guildId, userId: inviter.id });
            const isFake = (Date.now() - member.user.createdTimestamp) < (7 * 24 * 60 * 60 * 1000);
            invData.joins += 1;
            if (isFake) invData.fake += 1; else invData.regular += 1;
            await invData.save();

            if (config && config.inviteLogChannel) {
                const logChan = member.guild.channels.cache.get(config.inviteLogChannel);
                if (logChan) logChan.send(`• ${member} joined, invited by **${inviter.username}**.`);
            }
        }
    } catch (e) { console.error(e); }
});

// 3. Interactions, Tickets & Store Modals Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction);
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'setup_welcome_btn') {
            const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('Welcome Setup');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_title').setLabel('Title').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_msg').setLabel('Message').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_chan').setLabel('Channel ID').setRequired(true).setStyle(TextInputStyle.Short))
            );
            return interaction.showModal(modal);
        }
        if (interaction.customId === 'setup_tickets_btn') {
            const modal = new ModalBuilder().setCustomId('modal_ticket').setTitle('Ticket Setup');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc').setLabel('Panel Description').setRequired(true).setStyle(TextInputStyle.Paragraph)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_parent').setLabel('Category ID').setRequired(true).setStyle(TextInputStyle.Short))
            );
            return interaction.showModal(modal);
        }
        if (interaction.customId === 'setup_auto_btn') {
            const modal = new ModalBuilder().setCustomId('modal_auto').setTitle('Auto Response Setup');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('auto_box').setLabel('trigger:reply || trigger:reply').setRequired(true).setStyle(TextInputStyle.Paragraph)));
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guild.id;

        if (interaction.customId === 'modal_welcome') {
            await GuildConfig.findOneAndUpdate({ guildId }, {
                welcomeTitle: interaction.fields.getTextInputValue('w_title'),
                welcomeMessage: interaction.fields.getTextInputValue('w_msg'),
                welcomeChannel: interaction.fields.getTextInputValue('w_chan')
            }, { upsert: true });
            return interaction.editReply('✅ Welcome configuration saved!');
        }

        if (interaction.customId === 'modal_ticket') {
            const desc = interaction.fields.getTextInputValue('t_desc');
            const parent = interaction.fields.getTextInputValue('t_parent');
            await GuildConfig.findOneAndUpdate({ guildId }, { ticketDescription: desc, ticketParent: parent }, { upsert: true });

            const embed = new EmbedBuilder().setTitle('🎫 Support Tickets').setDescription(desc).setColor('#5865F2');
            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Select category...').addOptions({ label: 'General Support', value: 'General' });
            await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
            return interaction.editReply('✅ Ticket panel deployed!');
        }

        if (interaction.customId === 'modal_auto') {
            const raw = interaction.fields.getTextInputValue('auto_box');
            const autoResponses = raw.split('||').map(b => {
                const [trigger, replyText] = b.split(':');
                return { trigger: trigger?.trim().toLowerCase(), replyText: replyText?.trim() };
            }).filter(r => r.trigger && r.replyText);

            await GuildConfig.findOneAndUpdate({ guildId }, { autoResponses }, { upsert: true });
            return interaction.editReply('✅ Auto-responses updated!');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
                                                     
