const mongoose = require('mongoose');

const InviteDataSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    
    // Invite Stats Tracking Fields[span_0](start_span)[span_0](end_span)
    joins: { type: Number, default: 0 },
    regular: { type: Number, default: 0 },
    leaves: { type: Number, default: 0 },
    fake: { type: Number, default: 0 },
    rejoins: { type: Number, default: 0 },
    
    // Event / Short-Term Stats[span_1](start_span)[span_1](end_span)
    eventRegular: { type: Number, default: 0 },
    eventLeaves: { type: Number, default: 0 },
    eventFake: { type: Number, default: 0 },
    
    // Event Active State Tracker[span_2](start_span)[span_2](end_span)
    isEventActive: { type: Boolean, default: false }
});

InviteDataSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('InviteData', InviteDataSchema);
