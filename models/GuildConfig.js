const mongoose = require('mongoose');

const GuildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    
    // Welcome System
    welcomeChannel: { type: String, default: '' },
    welcomeMessage: { type: String, default: 'Welcome {user} to the server!' },
    welcomeThumbnail: { type: String, default: '' },

    // Goodbye System
    goodbyeChannel: { type: String, default: '' },
    goodbyeMessage: { type: String, default: '{user} has left the server.' },

    // Auto Response System
    autoResponses: [
        {
            trigger: { type: String, lowercase: true, trim: true },
            replyText: { type: String }
        }
    ],

    // YouTube Notification System
    ytChannelId: { type: String, default: null },
    ytLiveChannel: { type: String, default: null },
    ytUploadChannel: { type: String, default: null }
});

module.exports = mongoose.model('GuildConfig', GuildConfigSchema);
