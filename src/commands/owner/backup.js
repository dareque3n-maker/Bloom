const RecoveryEngine = require('../../security/RecoveryEngine');

module.exports = {
    name: 'backup',
    ownerOnly: true,
    async execute(message, args, client) {
        await RecoveryEngine.backupGuild(message.guild);
        return message.reply('Successfully created a complete security and configuration backup of the server.');
    }
};
