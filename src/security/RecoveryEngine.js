const RecoveryData = require('../models/RecoveryData');

class RecoveryEngine {
    static async backupGuild(guild) {
        try {
            const channels = guild.channels.cache.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                parentId: c.parentId,
                position: c.position,
                permissionOverwrites: c.permissionOverwrites.cache.map(p => ({
                    id: p.id,
                    type: p.type,
                    allow: p.allow.bitfield.toString(),
                    deny: p.deny.bitfield.toString()
                }))
            }));

            const roles = guild.roles.cache.map(r => ({
                id: r.id,
                name: r.name,
                color: r.color,
                hoist: r.hoist,
                position: r.position,
                permissions: r.permissions.bitfield.toString(),
                managed: r.managed
            }));

            await RecoveryData.findOneAndUpdate(
                { guildId: guild.id },
                { guildId: guild.id, channels, roles },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Recovery Backup Error:', error);
        }
    }
}

module.exports = RecoveryEngine;
