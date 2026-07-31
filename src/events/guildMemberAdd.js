const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        if (!member.user.bot) return;

        // Audit log generate hone ke liye 1 second ka gap taaki Discord API data fetch kar sake
        await new Promise(resolve => setTimeout(resolve, 1000));

        const auditLogs = await member.guild.fetchAuditLogs({ type: 168, limit: 1 }).catch(() => null);
        const auditLog = auditLogs?.entries.first();
        if (!auditLog) return;

        const executor = auditLog.executor;
        if (!executor || executor.id === client.user.id || executor.id === member.guild.ownerId) return;

        // Security engine check karega ki executor Administrator hai ya nahi, aur whitelisted hai ya nahi
        const securityResult = await client.security.handleSecurityEvent(member.guild, executor, 'BOT_ADD', member.user, 'ban');
        
        // Agar whitelisted nahi hai toh added bot ko kick/ban kar do aur security engine executor ko khud ban/punish kar dega
        if (!securityResult.allowed) {
            await member.kick('Unauthorized Bot Add Protection Triggered').catch(() => {});
        }
    }
};
        
