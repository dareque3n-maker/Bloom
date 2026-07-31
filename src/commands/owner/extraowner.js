const GuildConfig = require('../../models/GuildConfig');

module.exports = {
    name: 'extraowner',
    ownerOnly: true,
    async execute(message, args, client) {
        const action = args[0];
        const target = message.mentions.users.first();

        let config = await GuildConfig.findOne({ guildId: message.guild.id });
        if (!config) config = await GuildConfig.create({ guildId: message.guild.id });

        if (action === 'add' && target) {
            if (config.extraOwners.includes(target.id)) return message.reply('User is already an Extra Owner.');
            config.extraOwners.push(target.id);
            await config.save();
            client.cache.setGuildConfig(message.guild.id, config);
            return message.reply(`Successfully added ${target.tag} as Extra Owner.`);
        } else if (action === 'remove' && target) {
            config.extraOwners = config.extraOwners.filter(id => id !== target.id);
            await config.save();
            client.cache.setGuildConfig(message.guild.id, config);
            return message.reply(`Successfully removed ${target.tag} from Extra Owners.`);
        } else if (action === 'list') {
            const list = config.extraOwners.map(id => `<@${id}>`).join(', ') || 'None';
            return message.reply({ content: `**Extra Owners:** ${list}`, allowedMentions: { users: [] } });
        }

        return message.reply('Usage: s extraowner <add/remove/list> [@user]');
    }
};
