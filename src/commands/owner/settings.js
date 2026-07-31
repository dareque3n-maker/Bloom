const GuildConfig = require('../../models/GuildConfig');

module.exports = {
    name: 'settings',
    ownerOnly: true,
    async execute(message, args, client) {
        let config = await GuildConfig.findOne({ guildId: message.guild.id });
        if (!config) config = await GuildConfig.create({ guildId: message.guild.id });

        return message.reply({
            embeds: [{
                title: '🛡️ Enterprise Security Configuration',
                color: 0x00FF00,
                fields: [
                    { name: 'Prefix', value: config.prefix, inline: true },
                    { name: 'Punishment', value: config.punishment, inline: true },
                    { name: 'Extra Owners Count', value: `${config.extraOwners.length}`, inline: true },
                    { name: 'Whitelist Count', value: `${config.whitelist.length}`, inline: true },
                    { name: 'Anti-Nuke Module', value: `${config.modules.antiNuke}`, inline: true },
                    { name: 'Anti-Bot Module', value: `${config.modules.antiBot}`, inline: true },
                    { name: 'Chat Security Module', value: `${config.modules.chatSecurity}`, inline: true }
                ]
            }]
        });
    }
};
