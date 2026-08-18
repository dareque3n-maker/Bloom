const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Open paginated bot configuration control panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(opt => 
            opt.setName('page')
               .setDescription('Select panel page (1 or 2)')
               .setRequired(true)
               .addChoices(
                   { name: 'Page 1 (Welcome & Tickets)', value: 1 },
                   { name: 'Page 2 (Auto-Response & Invite Logs)', value: 2 }
               )
        ),

    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const page = interaction.options.getInteger('page');

            if (page === 1) {
                const embed = {
                    title: '⚙️ BOT CONFIGURATION PANEL — PAGE 1',
                    description: 'Manage server systems: Welcome and Support Tickets.',
                    color: 0x5865F2
                };
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('setup_welcome_btn').setLabel('Welcome').setEmoji('<a:welcome:1531251234147794964>').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('setup_tickets_btn').setLabel('Tickets').setEmoji('<a:store_cart:1531251190275379282>').setStyle(ButtonStyle.Primary)
                );
                return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }

            if (page === 2) {
                const embed = {
                    title: '⚙️ BOT CONFIGURATION PANEL — PAGE 2',
                    description: 'Manage automated systems: Auto-Responses and Invite Logs Channel.',
                    color: 0x5865F2
                };
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('setup_auto_btn').setLabel('Auto-Response').setEmoji('<a:update:1531251219975114752>').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_inv_logs_cfg').setLabel('Setup Invite Logs').setEmoji('<a:update:1531251219975114752>').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }
        }
    }
};
