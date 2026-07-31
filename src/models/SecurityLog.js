const { Schema, model } = require('mongoose');

const securityLogSchema = new Schema({
    guildId: { type: String, required: true },
    executorId: { type: String, required: true },
    action: { type: String, required: true },
    targetId: { type: String },
    punishment: { type: String, required: true },
    whitelistStatus: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = model('SecurityLog', securityLogSchema);
