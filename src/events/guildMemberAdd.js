const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        if (!member.user.bot) return;

        const auditLogs = await member.guild.fetchAuditLogs({ type: 168, limit: 1 }).catch(() => null);
        const auditLog = auditLogs?.entries.first();
        if (!auditLog) return;

        const executor = auditLog.executor;
        if (executor.id === client.user.id) return;

        const securityResult = await client.security.handleSecurityEvent(member.guild, executor, 'BOT_ADD', member.user, 'ban');
        if (!securityResult.allowed) {
            await member.kick('Unauthorized Bot Add Protection Triggered').catch(() => {});
        }
    }
};
