const { Schema, model } = require('mongoose');

const recoveryDataSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    channels: [{ type: Schema.Types.Mixed }],
    roles: [{ type: Schema.Types.Mixed }],
    categories: [{ type: Schema.Types.Mixed }],
    serverSettings: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = model('RecoveryData', recoveryDataSchema);
