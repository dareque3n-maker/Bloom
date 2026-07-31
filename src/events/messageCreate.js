const { Events } = require('discord.js');

const scamDomains = ['discord-nitro.gift', 'steam-gift.com', 'nitrogifts.me'];
const tokenRegex = /[\w-]{24}\.[\w-]{6}\.[\w-]{27}|mfa\.[\w-]{84}/;

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const content = message.content;
        
        if (tokenRegex.test(content)) {
            await message.delete().catch(() => {});
            await client.security.handleSecurityEvent(message.guild, message.author, 'TOKEN_LEAK', null, 'ban');
            return;
        }

        const isScam = scamDomains.some(domain => content.includes(domain));
        if (isScam) {
            await message.delete().catch(() => {});
            await client.security.handleSecurityEvent(message.guild, message.author, 'SCAM_LINK', null, 'kick');
            return;
        }

        if (content.includes('http://') || content.includes('https://') || content.includes('discord.gg/')) {
            const permLevel = await client.security.verifyPermission(message.guild, message.author);
            if (permLevel === 'UNTRUSTED') {
                await message.delete().catch(() => {});
            }
        }
    }
};
