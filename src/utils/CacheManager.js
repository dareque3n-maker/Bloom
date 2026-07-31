class CacheManager {
    constructor() {
        this.guildConfigs = new Map();
        this.whitelistedUsers = new Map();
        this.extraOwners = new Map();
        this.cooldowns = new Map();
        this.auditQueue = [];
    }

    getGuildConfig(guildId) {
        return this.guildConfigs.get(guildId);
    }

    setGuildConfig(guildId, config) {
        this.guildConfigs.set(guildId, config);
    }

    isWhitelisted(guildId, userId) {
        const guildWhitelist = this.whitelistedUsers.get(guildId);
        return guildWhitelist ? guildWhitelist.has(userId) : false;
    }

    isExtraOwner(guildId, userId) {
        const guildExtraOwners = this.extraOwners.get(guildId);
        return guildExtraOwners ? guildExtraOwners.has(userId) : false;
    }
}

module.exports = CacheManager;
