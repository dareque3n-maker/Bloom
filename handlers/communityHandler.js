const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const CommunitySettings = require('../models/CommunitySettings');

async function handleCommunityInteractions(interaction) {
    if (interaction.isButton()) {
        // 1. Welcome Setup Button
        if (interaction.customId === 'setup_welcome') {
            const modal = new ModalBuilder()
                .setCustomId('modal_welcome')
                .setTitle('👋 Welcome System Setup');

            const msgInput = new TextInputBuilder()
                .setCustomId('welcome_message')
                .setLabel('Welcome Message')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Welcome {user} to {memberCount} members!')
                .setRequired(true);

            const channelInput = new TextInputBuilder()
                .setCustomId('welcome_channel')
                .setLabel('Welcome Channel ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('123456789012345678')
                .setRequired(true);

            const bannerInput = new TextInputBuilder()
                .setCustomId('welcome_banner')
                .setLabel('Banner URL (Optional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('https://example.com/banner.png')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(msgInput),
                new ActionRowBuilder().addComponents(channelInput),
                new ActionRowBuilder().addComponents(bannerInput)
            );

            await interaction.showModal(modal);
        }

        // 2. Goodbye Setup Button
        else if (interaction.customId === 'setup_goodbye') {
            const modal = new ModalBuilder()
                .setCustomId('modal_goodbye')
                .setTitle('👋 Goodbye System Setup');

            const msgInput = new TextInputBuilder()
                .setCustomId('goodbye_message')
                .setLabel('Goodbye Message')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('{user} has left at {accountLefted}')
                .setRequired(true);

            const channelInput = new TextInputBuilder()
                .setCustomId('goodbye_channel')
                .setLabel('Goodbye Channel ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('123456789012345678')
                .setRequired(true);

            const bannerInput = new TextInputBuilder()
                .setCustomId('goodbye_banner')
                .setLabel('Banner URL (Optional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('https://example.com/banner.png')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(msgInput),
                new ActionRowBuilder().addComponents(channelInput),
                new ActionRowBuilder().addComponents(bannerInput)
            );

            await interaction.showModal(modal);
        }

        // 3. Auto Response Setup Button
        else if (interaction.customId === 'setup_autoresponse') {
            const modal = new ModalBuilder()
                .setCustomId('modal_autoresponse')
                .setTitle('💬 Auto Response Setup');

            const arInput = new TextInputBuilder()
                .setCustomId('auto_responses_list')
                .setLabel('Triggers & Replies (trigger:reply || ...)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('ip:play.network.fun || qr:https://... || meow:ghop ghop')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(arInput));
            await interaction.showModal(modal);
        }

        // 4. YT Notifications Setup Button
        else if (interaction.customId === 'setup_yt') {
            const modal = new ModalBuilder()
                .setCustomId('modal_yt')
                .setTitle('📺 YouTube Notifications Setup');

            const ytChan = new TextInputBuilder()
                .setCustomId('yt_channel_id')
                .setLabel('YT Channel UC ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('UCxxxxxxxxxxxxxx')
                .setRequired(true);

            const shortChan = new TextInputBuilder()
                .setCustomId('short_channel_id')
                .setLabel('Shorts Channel ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Channel ID for Shorts')
                .setRequired(false);

            const videoChan = new TextInputBuilder()
                .setCustomId('video_channel_id')
                .setLabel('Video Channel ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Channel ID for Videos')
                .setRequired(false);

            const liveChan = new TextInputBuilder()
                .setCustomId('live_channel_id')
                .setLabel('Live Stream Channel ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Channel ID for Live')
                .setRequired(false);

            const postChan = new TextInputBuilder()
                .setCustomId('post_channel_id')
                .setLabel('Community Post Channel ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Channel ID for Posts')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(ytChan),
                new ActionRowBuilder().addComponents(shortChan),
                new ActionRowBuilder().addComponents(videoChan),
                new ActionRowBuilder().addComponents(liveChan),
                new ActionRowBuilder().addComponents(postChan)
            );

            await interaction.showModal(modal);
        }
    }

    // Modal Submissions Saving Logic
    else if (interaction.isModalSubmit()) {
        const guildId = interaction.guild.id;

        if (interaction.customId === 'modal_welcome') {
            const message = interaction.fields.getTextInputValue('welcome_message');
            const channelId = interaction.fields.getTextInputValue('welcome_channel');
            const bannerUrl = interaction.fields.getTextInputValue('welcome_banner') || null;

            await CommunitySettings.findOneAndUpdate(
                { guildId },
                { $set: { 'welcome.enabled': true, 'welcome.message': message, 'welcome.channelId': channelId, 'welcome.bannerUrl': bannerUrl } },
                { upsert: true, new: true }
            );

            await interaction.reply({ content: '✅ Welcome system successfully configured!', ephemeral: true });
        } 
        else if (interaction.customId === 'modal_goodbye') {
            const message = interaction.fields.getTextInputValue('goodbye_message');
            const channelId = interaction.fields.getTextInputValue('goodbye_channel');
            const bannerUrl = interaction.fields.getTextInputValue('goodbye_banner') || null;

            await CommunitySettings.findOneAndUpdate(
                { guildId },
                { $set: { 'goodbye.enabled': true, 'goodbye.message': message, 'goodbye.channelId': channelId, 'goodbye.bannerUrl': bannerUrl } },
                { upsert: true, new: true }
            );

            await interaction.reply({ content: '✅ Goodbye system successfully configured!', ephemeral: true });
        }
        else if (interaction.customId === 'modal_autoresponse') {
            const rawText = interaction.fields.getTextInputValue('auto_responses_list');
            // Parse format: trigger:reply || trigger:reply
            const entries = rawText.split('||').map(item => {
                const parts = item.split(':');
                if (parts.length >= 2) {
                    return {
                        trigger: parts[0].trim().toLowerCase(),
                        reply: parts.slice(1).join(':').trim()
                    };
                }
                return null;
            }).filter(Boolean);

            await CommunitySettings.findOneAndUpdate(
                { guildId },
                { $set: { autoResponses: entries } },
                { upsert: true, new: true }
            );

            await interaction.reply({ content: `✅ Successfully saved **${entries.length}** auto responses!`, ephemeral: true });
        }
        else if (interaction.customId === 'modal_yt') {
            const ytChannelId = interaction.fields.getTextInputValue('yt_channel_id');
            const shortChannelId = interaction.fields.getTextInputValue('short_channel_id') || null;
            const videoChannelId = interaction.fields.getTextInputValue('video_channel_id') || null;
            const liveChannelId = interaction.fields.getTextInputValue('live_channel_id') || null;
            const postChannelId = interaction.fields.getTextInputValue('post_channel_id') || null;

            await CommunitySettings.findOneAndUpdate(
                { guildId },
                { $set: { youtube: { ytChannelId, shortChannelId, videoChannelId, liveChannelId, postChannelId } } },
                { upsert: true, new: true }
            );

            await interaction.reply({ content: '✅ YouTube Notification channels successfully configured!', ephemeral: true });
        }
    }
}

module.exports = { handleCommunityInteractions };
