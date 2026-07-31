const SecurityLog = require('../models/SecurityLog');
const GuildConfig = require('../models/GuildConfig');

class SecurityEngine {
    constructor(client) {
        this.client = client;
    }

    async verifyPermission(guild, user) {
        if (guild.ownerId === user.id) return 'OWNER';
        
        let config = this.client.cache.getGuildConfig(guild.id);
        if (!config) {
            config = await GuildConfig.findOne({ guildId: guild.id }) || await GuildConfig.create({ guildId: guild.id });
            this.client.cache.setGuildConfig(guild.id, config);
        }

        if (config.extraOwners.includes(user.id)) return 'EXTRA_OWNER';
        if (config.whitelist.includes(user.id)) return 'WHITELISTED';
        return 'UNTRUSTED';
    }

    async handleSecurityEvent(guild, executor, action, target, punishmentType = 'ban') {
        const permLevel = await this.verifyPermission(guild, executor);
        if (permLevel === 'OWNER' || permLevel === 'EXTRA_OWNER') {
            return { allowed: true, permLevel };
        }

        const isWhitelisted = permLevel === 'WHITELISTED';
        
        await SecurityLog.create({
            guildId: guild.id,
            executorId: executor.id,
            action,
            targetId: target?.id,
            punishment: isWhitelisted ? 'SKIPPED' : punishmentType,
            whitelistStatus: isWhitelisted ? 'WHITELISTED' : 'BLOCKED'
        });

        await this.sendOwnerDM(guild, executor, action, target, isWhitelisted ? 'SKIPPED' : punishmentType, permLevel);

        if (!isWhitelisted) {
            await this.executePunishment(guild, executor, punishmentType);
            return { allowed: false, permLevel };
        }

        return { allowed: true, permLevel };
    }

    async executePunishment(guild, user, type) {
        try {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            if (type === 'ban' && member.bannable) {
                await guild.bans.create(member, { reason: 'Enterprise Security Engine: Unauthorized Action' });
            } else if (type === 'kick' && member.kickable) {
                await member.kick('Enterprise Security Engine: Unauthorized Action');
            }
        } catch (error) {
            console.error('Punishment Execution Failed:', error);
        }
    }

    async sendOwnerDM(guild, executor, action, target, punishment, whitelistStatus) {
        try {
            const owner = await guild.fetchOwner();
            const embed = {
                color: 0xFF0000,
                title: '🚨 SECURITY INCIDENT DETECTED',
                fields: [
                    { name: 'Server', value: `${guild.name} (${guild.id})`, inline: true },
                    { name: 'Executor', value: `${executor.tag} (${executor.id})`, inline: true },
                    { name: 'Action', value: action, inline: true },
                    { name: 'Target', value: target ? `${target.tag || target.name} (${target.id})` : 'N/A', inline: true },
                    { name: 'Whitelist Status', value: whitelistStatus, inline: true },
                    { name: 'Punishment', value: punishment, inline: true },
                    { name: 'Timestamp', value: new Date().toISOString(), inline: false }
                ],
                timestamp: new Date()
            };
            await owner.send({ embeds: [embed] }).catch(() => {});
        } catch (error) {
            console.error('Failed to send Owner DM:', error);
        }
    }
}

module.exports = SecurityEngine;
