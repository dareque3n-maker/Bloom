const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const activeGiveaways = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Start a community giveaway")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(o => o.setName("channel").setDescription("Giveaway channel").setRequired(true))
        .addStringOption(o => o.setName("reward").setDescription("Prize description").setRequired(true))
        .addIntegerOption(o => o.setName("winners").setDescription("Number of winners").setRequired(true))
        .addStringOption(o => o.setName("time").setDescription("Duration (e.g., 30s, 10m, 1h)").setRequired(true)),

    async execute(interaction) {
        const channel = interaction.options.getChannel("channel");
        const reward = interaction.options.getString("reward");
        const winners = interaction.options.getInteger("winners");
        const ms = parseTime(interaction.options.getString("time"));
        const endTime = Date.now() + ms;

        const embed = new EmbedBuilder()
            .setColor("Gold")
            .setTitle("🎉 GIVEAWAY STARTED 🎉")
            .setDescription(`Reward: **${reward}**\nWinners: **${winners}**\nEnds: <t:${Math.floor(endTime / 1000)}:R>\n\nReact with 🎁 to enter!`);

        const msg = await channel.send({ embeds: [embed] });
        await msg.react("🎁");

        setTimeout(() => endGiveaway(msg.id, interaction.client, reward, winners, channel.id), ms);
        return interaction.reply({ content: "✅ Giveaway started successfully!", ephemeral: true });
    }
};

async function endGiveaway(messageId, client, reward, winnerCount, channelId) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return;

    const reaction = message.reactions.cache.get("🎁");
    if (!reaction) return;

    const users = [...(await reaction.users.fetch({ limit: 100 })).values()].filter(u => !u.bot);
    let winners = [];
    for (let i = 0; i < winnerCount; i++) {
        if (users.length === 0) break;
        const index = Math.floor(Math.random() * users.length);
        winners.push(`<@${users[index].id}>`);
        users.splice(index, 1);
    }

    await channel.send(`🎊 Congratulations ${winners.join(", ")}! You won **${reward}**!`);
}

function parseTime(t) {
    const num = parseInt(t);
    if (t.includes("m")) return num * 60000;
    if (t.includes("h")) return num * 3600000;
    if (t.includes("d")) return num * 86400000;
    return num * 1000;
}
