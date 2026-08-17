const mongoose = require('mongoose');

const InviteDataSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    joins: { type: Number, default: 0 },
    regular: { type: Number, default: 0 },
    leaves: { type: Number, default: 0 },
    fake: { type: Number, default: 0 },
    rejoins: { type: Number, default: 0 },
    eventRegular: { type: Number, default: 0 },
    eventLeaves: { type: Number, default: 0 },
    eventFake: { type: Number, default: 0 },
    isEventActive: { type: Boolean, default: false }
});

InviteDataSchema.index({ guildId: 1, userId: 1 }, { unique: true });

// Safe model export to prevent OverwriteModelError
module.exports = mongoose.models.InviteData || mongoose.model('InviteData', InviteDataSchema);
