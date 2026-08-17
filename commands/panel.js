const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Open bot configuration control panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(opt => 
            opt.setName('page')
               .setDescription('Select panel page')
               .setRequired(true)
               .addChoices(
                   { name: 'Page 1 (Welcome, Tickets, Invite Logs)', value: 1 },
                   { name: 'Page 2 (Auto-Response)', value: 2 }
               )
        ),
    async execute(interaction) {
        const page = interaction.options.getInteger('page');
        if (page === 1) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_welcome_btn').setLabel('Welcome').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('setup_tickets_btn').setLabel('Tickets').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_inv_logs_cfg').setLabel('Invite Logs').setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ content: '⚙️ **Core Systems Setup Panel (Page 1):**', components: [row], ephemeral: true });
        } else {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_auto_btn').setLabel('Auto-Response Setup').setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ content: '⚙️ **Automation Setup Panel (Page 2):**', components: [row], ephemeral: true });
        }
    }
};
