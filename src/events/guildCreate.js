const { Events } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild, client) {
        let config = await GuildConfig.findOne({ guildId: guild.id });
        if (!config) {
            config = await GuildConfig.create({ guildId: guild.id });
        }
        client.cache.setGuildConfig(guild.id, config);
    }
};
