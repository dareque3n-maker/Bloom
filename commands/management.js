const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('management')
        .setDescription('Open the master server management control panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('panel').setDescription('Deploy management dashboard')),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'panel') {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ MASTER MANAGEMENT DASHBOARD')
                .setDescription('Welcome to the server administration control panel. Select any module below to configure your server systems dynamically.')
                .setColor('#5865F2')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_ticket_master')
                    .setLabel('Ticket')
                    .setEmoji('🎫')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('setup_store_master')
                    .setLabel('Store')
                    .setEmoji('🛒')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('setup_staff_master')
                    .setLabel('Staff Apply')
                    .setEmoji('📝')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('setup_logs_master')
                    .setLabel('Logs')
                    .setEmoji('📋')
                    .setStyle(ButtonStyle.Danger)
            );

            return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    }
};
