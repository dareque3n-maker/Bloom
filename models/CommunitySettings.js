const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    welcome: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        message: { type: String, default: "Welcome {user} to the server!" },
        bannerUrl: { type: String, default: null }
    },
    goodbye: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null },
        message: { type: String, default: "{user} has left the server." },
        bannerUrl: { type: String, default: null }
    },
    autoResponses: [
        {
            trigger: { type: String },
            reply: { type: String }
        }
    ],
    youtube: {
        ytChannelId: { type: String, default: null },
        shortChannelId: { type: String, default: null },
        videoChannelId: { type: String, default: null },
        liveChannelId: { type: String, default: null },
        postChannelId: { type: String, default: null }
    }
});

module.exports = mongoose.model('CommunitySettings', communitySchema);
