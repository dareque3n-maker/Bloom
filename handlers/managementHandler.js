const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { GuildConfig, TicketSession } = require('../models/GuildConfig');

async function handleManagementInteractions(interaction) {
    const guildId = interaction.guild.id;

    if (interaction.isButton()) {
        if (interaction.customId === 'setup_community_all') {
            const modal = new ModalBuilder().setCustomId('modal_community_config').setTitle('🌍 Community Systems Setup');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_chan').setLabel('Welcome Channel ID').setStyle(TextInputStyle.Short).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_msg').setLabel('Welcome Message').setStyle(TextInputStyle.Paragraph).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('g_chan').setLabel('Goodbye Channel ID').setStyle(TextInputStyle.Short).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ar_list').setLabel('Auto-Responses (trig:reply || trig:reply)').setStyle(TextInputStyle.Paragraph).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_ids').setLabel('YT: ChannelID || LiveID || UploadID').setStyle(TextInputStyle.Short).setRequired(false))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'setup_master_ticket') {
            const store = await GuildConfig.findOne({ guildId });
            const modal = new ModalBuilder().setCustomId('modal_master_ticket_config').setTitle('🎫 Ticket System Config');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc_banner').setLabel('Description || Banner URL').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(`${store?.ticketDescription || 'Support'} || ${store?.ticketBanner || ''}`)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_dms').setLabel('DMs: Approved || Rejected').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(`${store?.appDmApproved || 'Approved'} || ${store?.appDmRejected || 'Rejected'}`)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_logs').setLabel('Logs: Ticket || Store || Staff || Console').setStyle(TextInputStyle.Short).setRequired(true).setValue(`${store?.ticketLogs || ''}, ${store?.storeLogs || ''}, ${store?.appStaffChannelId || ''}, ${store?.consoleChannelId || ''}`)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_roles').setLabel('Roles: Ticket Manage Role || Store Role').setStyle(TextInputStyle.Short).setRequired(true).setValue(`${store?.ticketRole || ''}, ${store?.storeRole || ''}`)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_parent').setLabel('Category Parent ID').setStyle(TextInputStyle.Short).setRequired(true).setValue(store?.ticketParent || ''))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'deploy_ticket_panel') {
            const modal = new ModalBuilder().setCustomId('modal_deploy_ticket').setTitle('🚀 Deploy Ticket Panel');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target_chan').setLabel('Target Channel ID').setStyle(TextInputStyle.Short).setRequired(true)));
            return await interaction.showModal(modal);
        }

        // Ticket Claim & Close logic
        if (interaction.customId === 'claim_ticket_btn') {
            const session = await TicketSession.findOne({ channelId: interaction.channel.id });
            if (!session) return await interaction.reply({ content: '❌ Session not found.', ephemeral: true });

            const config = await GuildConfig.findOne({ guildId });
            if (config?.ticketRole && !interaction.member.roles.cache.has(config.ticketRole)) {
                return await interaction.reply({ content: '❌ Restricted to support staff.', ephemeral: true });
            }

            if (interaction.channel.name.includes('✅')) {
                return await interaction.reply({ content: '⚠️ Already claimed!', ephemeral: true });
            }

            // Rename to #0001-✅ style
            const currentNumMatch = interaction.channel.name.match(/\d+/);
            const numStr = currentNumMatch ? currentNumMatch[0] : '0001';
            await interaction.channel.setName(`${numStr}-✅`).catch(() => {});

            await interaction.reply({ content: `🔒 Ticket claimed by ${interaction.user}` });

            const editedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket_btn').setLabel('Claimed').setStyle(ButtonStyle.Success).setDisabled(true).setEmoji('✅'),
                new ButtonBuilder().setCustomId('close_ticket_btn').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            return await interaction.message.edit({ components: [editedRow] });
        }

        if (interaction.customId === 'close_ticket_btn') {
            await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...' });
            const fetched = await interaction.channel.messages.fetch({ limit: 100 });
            let txt = '';
            [...fetched.values()].reverse().forEach(m => { txt += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`; });
            const attachment = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: 'transcript.txt' });

            const config = await GuildConfig.findOne({ guildId });
            if (config && config.ticketLogs) {
                const logChan = interaction.guild.channels.cache.get(config.ticketLogs);
                if (logChan) await logChan.send({ content: `📁 Ticket closed by ${interaction.user.tag}`, files: [attachment] }).catch(() => {});
            }

            await TicketSession.deleteOne({ channelId: interaction.channel.id });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }

    else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_community_config') {
            const welcomeChannel = interaction.fields.getTextInputValue('w_chan');
            const welcomeMessage = interaction.fields.getTextInputValue('w_msg');
            const goodbyeChannel = interaction.fields.getTextInputValue('g_chan');
            
            const arRaw = interaction.fields.getTextInputValue('ar_list');
            const autoResponses = arRaw ? arRaw.split('||').map(item => {
                const p = item.split(':');
                return p.length >= 2 ? { trigger: p[0].trim().toLowerCase(), replyText: p.slice(1).join(':').trim() } : null;
            }).filter(Boolean) : [];

            const ytRaw = interaction.fields.getTextInputValue('yt_ids').split('||');

            await GuildConfig.findOneAndUpdate({ guildId }, {
                welcomeChannel, welcomeMessage, goodbyeChannel, autoResponses,
                ytChannelId: ytRaw[0]?.trim() || null,
                ytLiveChannel: ytRaw[1]?.trim() || null,
                ytUploadChannel: ytRaw[2]?.trim() || null
            }, { upsert: true });

            return await interaction.reply({ content: '✅ Community settings successfully saved!', ephemeral: true });
        }

        if (interaction.customId === 'modal_master_ticket_config') {
            const descBanner = interaction.fields.getTextInputValue('t_desc_banner').split('||');
            const dms = interaction.fields.getTextInputValue('t_dms').split('||');
            const logs = interaction.fields.getTextInputValue('t_logs').split(',').map(s => s.trim());
            const roles = interaction.fields.getTextInputValue('t_roles').split(',').map(s => s.trim());
            const parent = interaction.fields.getTextInputValue('t_parent').trim();

            await GuildConfig.findOneAndUpdate({ guildId }, {
                ticketDescription: descBanner[0]?.trim(),
                ticketBanner: descBanner[1]?.trim() || '',
                appDmApproved: dms[0]?.trim(),
                appDmRejected: dms[1]?.trim(),
                ticketLogs: logs[0],
                storeLogs: logs[1],
                appStaffChannelId: logs[2],
                consoleChannelId: logs[3],
                ticketRole: roles[0],
                storeRole: roles[1],
                ticketParent: parent
            }, { upsert: true });

            return await interaction.reply({ content: '✅ Advanced Ticket & Log configurations saved successfully!', ephemeral: true });
        }

        if (interaction.customId === 'modal_deploy_ticket') {
            const targetChanId = interaction.fields.getTextInputValue('target_chan').trim();
            const chan = interaction.guild.channels.cache.get(targetChanId);
            if (!chan) return await interaction.reply({ content: '❌ Invalid channel ID.', ephemeral: true });

            const config = await GuildConfig.findOne({ guildId });
            const embed = new EmbedBuilder()
                .setTitle('🎫 SUPPORT TICKET SYSTEM')
                .setDescription(config?.ticketDescription || 'Click the button below to open a support ticket.')
                .setColor('#5865F2');

            if (config?.ticketBanner && config.ticketBanner.startsWith('http')) {
                embed.setImage(config.ticketBanner);
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('create_ticket_btn').setLabel('Create Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
            );

            await chan.send({ embeds: [embed], components: [row] });
            return await interaction.reply({ content: `✅ Ticket panel successfully deployed in <#${targetChanId}>`, ephemeral: true });
        }
    }

    // Ticket Creation Handler (1 user = 1 active ticket & sequential #0001 name format)
    if (interaction.isButton() && interaction.customId === 'create_ticket_btn') {
        const existingSession = await TicketSession.findOne({ guildId, userId: interaction.user.id });
        if (existingSession) {
            return await interaction.reply({ content: `⚠️ You already have an active ticket open: <#${existingSession.channelId}>`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const config = await GuildConfig.findOne({ guildId });
        const counter = config?.ticketCounter || 1;
        const formattedNum = String(counter).padStart(4, '0'); // #0001 format
        const channelName = `${formattedNum}`;

        const ticketChan = await interaction.guild.channels.create({
            name: channelName,
            parent: config?.ticketParent || null,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...(config?.ticketRole ? [{ id: config.ticketRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
            ]
        });

        // Increment counter
        await GuildConfig.findOneAndUpdate({ guildId }, { $inc: { ticketCounter: 1 } });

        await TicketSession.create({
            guildId,
            userId: interaction.user.id,
            channelId: ticketChan.id
        });

        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket_btn').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('close_ticket_btn').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        const staffPing = config?.ticketRole ? `<@&${config.ticketRole}>` : '';
        await ticketChan.send({ content: `${interaction.user} ${staffPing}`, embeds: [new EmbedBuilder().setTitle('Support Room').setDescription('Please describe your issue. Staff will assist you shortly.').setColor('#00FFCC')], components: [controlRow] });

        return await interaction.editReply({ content: `✅ Your ticket has been created: ${ticketChan}` });
    }
}

module.exports = { handleManagementInteractions };
