const { Events } = require('discord.js');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel, client) {
        const auditLogs = await channel.guild.fetchAuditLogs({ type: 10, limit: 1 }).catch(() => null);
        const auditLog = auditLogs?.entries.first();
        if (!auditLog) return;

        await client.security.handleSecurityEvent(channel.guild, auditLog.executor, 'CHANNEL_CREATE', channel, 'ban');
    }
};
