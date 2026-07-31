const SecurityLog = require('../../models/SecurityLog');

module.exports = {
    name: 'logs',
    ownerOnly: true,
    async execute(message, args, client) {
        const logs = await SecurityLog.find({ guildId: message.guild.id }).sort({ timestamp: -1 }).limit(10);
        if (!logs.length) return message.reply('No security logs found for this server.');

        let logText = logs.map(l => `[${l.timestamp.toISOString()}] Action: ${l.action} | Executor: <@${l.executorId}> | Status: ${l.whitelistStatus}`).join('\n');
        
        return message.reply({ content: `**Recent Security Logs:**\n\`\`\`${logText}\`\`\``, allowedMentions: { users: [] } });
    }
};
