const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const prefix = 's';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);
        if (!command) return;

        const permLevel = await client.security.verifyPermission(message.guild, message.author);
        if (command.ownerOnly && permLevel !== 'OWNER' && permLevel !== 'EXTRA_OWNER') {
            return message.reply('This command is restricted to Server Owners and Extra Owners.');
        }

        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error('Command Execution Error:', error);
            await message.reply('An error occurred executing this command.');
        }
    }
};
