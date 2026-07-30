const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('community')
        .setDescription('Open the community management panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🌍 Community Management Panel')
            .setDescription('Select an option below to configure community features for this server.')
            .setColor('#5865F2');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup_welcome').setLabel('Welcome Setup').setStyle(ButtonStyle.Primary).setEmoji('👋'),
            new ButtonBuilder().setCustomId('setup_goodbye').setLabel('Goodbye Setup').setStyle(ButtonStyle.Danger).setEmoji('👋'),
            new ButtonBuilder().setCustomId('setup_autoresponse').setLabel('Auto Response').setStyle(ButtonStyle.Success).setEmoji('💬'),
            new ButtonBuilder().setCustomId('setup_yt').setLabel('YT Notifications').setStyle(ButtonStyle.Secondary).setEmoji('📺')
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
};
