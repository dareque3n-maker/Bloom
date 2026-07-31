const { Schema, model } = require('mongoose');

const guildConfigSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, default: 's' },
    extraOwners: [{ type: String }],
    whitelist: [{ type: String }],
    modules: {
        antiNuke: { type: Boolean, default: true },
        antiBot: { type: Boolean, default: true },
        chatSecurity: { type: Boolean, default: true },
        recovery: { type: Boolean, default: true }
    },
    punishment: { type: String, default: 'ban' },
    logChannel: { type: String, default: null }
}, { timestamps: true });

module.exports = model('GuildConfig', guildConfigSchema);
