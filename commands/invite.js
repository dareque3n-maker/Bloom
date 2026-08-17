const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { InviteData } = require('../models/InviteData');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Check invite stats')
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;
        const data = await InviteData.findOne({ guildId: interaction.guild.id, userId: target.id }) || { joins: 0, regular: 0, leaves: 0, fake: 0 };
        const net = data.regular - data.leaves - data.fake;

        const embed = new EmbedBuilder()
            .setDescription(`**${target.username} has ${net} invites**\nJoins: ${data.joins} | Left: ${data.leaves} | Fake: ${data.fake}`)
            .setColor('#FFCC00');
        return interaction.reply({ embeds: [embed] });
    }
};
