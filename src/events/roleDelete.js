const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role, client) {
        const auditLogs = await role.guild.fetchAuditLogs({ type: 32, limit: 1 }).catch(() => null);
        const auditLog = auditLogs?.entries.first();
        if (!auditLog) return;

        await client.security.handleSecurityEvent(role.guild, auditLog.executor, 'ROLE_DELETE', role, 'ban');
    }
};
