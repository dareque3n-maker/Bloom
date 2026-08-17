const mongoose = require('mongoose');

const GuildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    welcomeTitle: { type: String, default: '' },
    welcomeMessage: { type: String, default: '' },
    welcomeChannel: { type: String, default: '' },
    welcomeThumbnail: { type: String, default: '' },
    inviteLogChannel: { type: String, default: null },
    
    ticketDescription: { type: String, default: '' },
    ticketBanner: { type: String, default: '' },
    ticketParent: { type: String, default: '' },
    ticketLogs: { type: String, default: '' },
    ticketRole: { type: String, default: '' },   
    ticketMessage: { type: String, default: '' },

    autoResponses: [
        {
            trigger: { type: String, lowercase: true, trim: true },
            replyText: { type: String }
        }
    ]
});

const InviteDataSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    joins: { type: Number, default: 0 },
    regular: { type: Number, default: 0 },
    leaves: { type: Number, default: 0 },
    fake: { type: Number, default: 0 },
    rejoins: { type: Number, default: 0 }
});
InviteDataSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = {
    GuildConfig: mongoose.model('GuildConfig', GuildConfigSchema),
    InviteData: mongoose.model('InviteData', InviteDataSchema)
};
