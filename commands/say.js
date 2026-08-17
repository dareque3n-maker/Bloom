const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("say")
        .setDescription("Send an announcement message inside an embed")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt => opt.setName("channel").setRequired(true).setDescription("Target text channel"))
        .addStringOption(opt => opt.setName("message").setRequired(true).setDescription("Announcement text (use \\n for new lines)")),

    async execute(interaction) {
        const channel = interaction.options.getChannel("channel");
        const message = interaction.options.getString("message").replace(/\\n/g, '\n');

        const embed = new EmbedBuilder().setDescription(message).setColor("Blue").setTimestamp();
        await channel.send({ embeds: [embed] });
        return interaction.reply({ content: "✅ Announcement sent successfully!", ephemeral: true });
    }
};
