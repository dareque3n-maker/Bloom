const { EmbedBuilder } = require('discord.js');
const CommunitySettings = require('../models/CommunitySettings');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        const settings = await CommunitySettings.findOne({ guildId: member.guild.id });
        if (!settings || !settings.welcome.enabled || !settings.welcome.channelId) return;

        const channel = member.guild.channels.cache.get(settings.welcome.channelId);
        if (!channel) return;

        let rawMsg = settings.welcome.message;

        // Variables replacement
        const formattedMsg = rawMsg
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{memberCount}/g, member.guild.memberCount)
            .replace(/{accountCreate}/g, `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
            .replace(/{memberJoined}/g, `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`);

        const embed = new EmbedBuilder()
            .setDescription(formattedMsg)
            .setColor('#00FFCC')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 })) // Right side avatar
            .setTimestamp();

        if (settings.welcome.bannerUrl) {
            embed.setImage(settings.welcome.bannerUrl);
        }

        channel.send({ embeds: [embed] });
    }
};
