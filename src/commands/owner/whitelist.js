const GuildConfig = require('../../models/GuildConfig');

module.exports = {
    name: 'whitelist',
    ownerOnly: true,
    async execute(message, args, client) {
        const action = args[0];
        const target = message.mentions.users.first();

        let config = await GuildConfig.findOne({ guildId: message.guild.id });
        if (!config) config = await GuildConfig.create({ guildId: message.guild.id });

        if (action === 'add' && target) {
            if (config.whitelist.includes(target.id)) return message.reply('User is already whitelisted.');
            config.whitelist.push(target.id);
            await config.save();
            client.cache.setGuildConfig(message.guild.id, config);
            return message.reply(`Successfully whitelisted ${target.tag}.`);
        } else if (action === 'remove' && target) {
            config.whitelist = config.whitelist.filter(id => id !== target.id);
            await config.save();
            client.cache.setGuildConfig(message.guild.id, config);
            return message.reply(`Successfully removed ${target.tag} from whitelist.`);
        } else if (action === 'list') {
            const list = config.whitelist.map(id => `<@${id}>`).join(', ') || 'None';
            return message.reply({ content: `**Whitelisted Users:** ${list}`, allowedMentions: { users: [] } });
        }

        return message.reply('Usage: s whitelist <add/remove/list> [@user]');
    }
};
