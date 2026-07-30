const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

async function handleCommunityInteractions(interaction) {
    const guildId = interaction.guild.id;

    if (interaction.isButton()) {
        if (interaction.customId === 'setup_welcome') {
            const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('👋 Welcome System Setup');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_msg').setLabel('Welcome Message').setStyle(TextInputStyle.Paragraph).setPlaceholder('Welcome {user} to {memberCount} members!').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_chan').setLabel('Welcome Channel ID').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w_thumb').setLabel('Banner/Thumbnail URL (Optional)').setStyle(TextInputStyle.Short).setRequired(false))
            );
            await interaction.showModal(modal);
        }
        else if (interaction.customId === 'setup_goodbye') {
            const modal = new ModalBuilder().setCustomId('modal_goodbye').setTitle('👋 Goodbye System Setup');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('g_msg').setLabel('Goodbye Message').setStyle(TextInputStyle.Paragraph).setPlaceholder('{user} left at {accountLefted}').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('g_chan').setLabel('Goodbye Channel ID').setStyle(TextInputStyle.Short).setRequired(true))
            );
            await interaction.showModal(modal);
        }
        else if (interaction.customId === 'setup_autoresponse') {
            const modal = new ModalBuilder().setCustomId('modal_autoresponse').setTitle('💬 Auto Response Setup');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ar_list').setLabel('Format: trigger:reply || trigger:reply').setStyle(TextInputStyle.Paragraph).setPlaceholder('ip:play.fun || store:link here').setRequired(true))
            );
            await interaction.showModal(modal);
        }
        else if (interaction.customId === 'setup_yt') {
            const modal = new ModalBuilder().setCustomId('modal_yt').setTitle('📺 YouTube Notifications Setup');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_uc').setLabel('YT Channel UC ID').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_live').setLabel('Live Stream Channel ID').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yt_upload').setLabel('Video/Shorts Channel ID').setStyle(TextInputStyle.Short).setRequired(true))
            );
            await interaction.showModal(modal);
        }
    }

    else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_welcome') {
            const welcomeMessage = interaction.fields.getTextInputValue('w_msg');
            const welcomeChannel = interaction.fields.getTextInputValue('w_chan');
            const welcomeThumbnail = interaction.fields.getTextInputValue('w_thumb') || '';

            await GuildConfig.findOneAndUpdate({ guildId }, { welcomeMessage, welcomeChannel, welcomeThumbnail }, { upsert: true });
            await interaction.reply({ content: '✅ Welcome system configured successfully!', ephemeral: true });
        }
        else if (interaction.customId === 'modal_goodbye') {
            const goodbyeMessage = interaction.fields.getTextInputValue('g_msg');
            const goodbyeChannel = interaction.fields.getTextInputValue('g_chan');

            await GuildConfig.findOneAndUpdate({ guildId }, { goodbyeMessage, goodbyeChannel }, { upsert: true });
            await interaction.reply({ content: '✅ Goodbye system configured successfully!', ephemeral: true });
        }
        else if (interaction.customId === 'modal_autoresponse') {
            const rawText = interaction.fields.getTextInputValue('ar_list');
            const autoResponses = rawText.split('||').map(item => {
                const parts = item.split(':');
                if (parts.length >= 2) {
                    return { trigger: parts[0].trim().toLowerCase(), replyText: parts.slice(1).join(':').trim() };
                }
                return null;
            }).filter(Boolean);

            await GuildConfig.findOneAndUpdate({ guildId }, { autoResponses }, { upsert: true });
            await interaction.reply({ content: `✅ Saved **${autoResponses.length}** auto responses!`, ephemeral: true });
        }
        else if (interaction.customId === 'modal_yt') {
            const ytChannelId = interaction.fields.getTextInputValue('yt_uc');
            const ytLiveChannel = interaction.fields.getTextInputValue('yt_live');
            const ytUploadChannel = interaction.fields.getTextInputValue('yt_upload');

            await GuildConfig.findOneAndUpdate({ guildId }, { ytChannelId, ytLiveChannel, ytUploadChannel }, { upsert: true });
            await interaction.reply({ content: '✅ YouTube notification channels configured!', ephemeral: true });
        }
    }
}

module.exports = { handleCommunityInteractions };
                
