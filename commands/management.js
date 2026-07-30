const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

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
                .setDescription('Configure your community systems or deploy the ticket panel using the buttons below.')
                .setColor('#5865F2');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_community_all').setLabel('Community Setup').setStyle(ButtonStyle.Primary).setEmoji('🌍'),
                new ButtonBuilder().setCustomId('setup_master_ticket').setLabel('Ticket System Setup').setStyle(ButtonStyle.Success).setEmoji('🎫'),
                new ButtonBuilder().setCustomId('deploy_ticket_panel').setLabel('Deploy Ticket Panel').setStyle(ButtonStyle.Secondary).setEmoji('🚀')
            );

            return await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
        }
    }
};
