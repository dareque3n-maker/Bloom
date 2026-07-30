const mongoose = require('mongoose');

const GuildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    
    // Community Settings
    welcomeChannel: { type: String, default: '' },
    welcomeMessage: { type: String, default: 'Welcome {user}!' },
    welcomeThumbnail: { type: String, default: '' },
    goodbyeChannel: { type: String, default: '' },
    goodbyeMessage: { type: String, default: '{user} has left.' },
    
    // Auto Responses
    autoResponses: [
        {
            trigger: { type: String, lowercase: true, trim: true },
            replyText: { type: String }
        }
    ],

    // YouTube Settings
    ytChannelId: { type: String, default: null },
    ytLiveChannel: { type: String, default: null },
    ytUploadChannel: { type: String, default: null },

    // Advanced Ticket & Management Settings
    ticketParent: { type: String, default: '' },
    ticketLogs: { type: String, default: '' },
    storeLogs: { type: String, default: '' },
    appStaffChannelId: { type: String, default: '' },
    consoleChannelId: { type: String, default: '' },
    ticketRole: { type: String, default: '' },
    storeRole: { type: String, default: '' },
    ticketDescription: { type: String, default: '' },
    ticketBanner: { type: String, default: '' },
    ticketMessage: { type: String, default: 'Thank you for contacting support.' },
    ticketCounter: { type: Number, default: 1 }
});

const TicketSessionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    channelId: { type: String, required: true },
    status: { type: String, default: 'open' }
});

module.exports = {
    GuildConfig: mongoose.model('GuildConfig', GuildConfigSchema),
    TicketSession: mongoose.model('TicketSession', TicketSessionSchema)
};
