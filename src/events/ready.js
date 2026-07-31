const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`[SECURE BOT] Logged in as ${client.user.tag}`);
        client.user.setActivity('Enterprise Security Active', { type: 3 });
    }
};
