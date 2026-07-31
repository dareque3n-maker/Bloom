const { Events } = require('discord.js');

const scamDomains = ['discord-nitro.gift', 'steam-gift.com', 'nitrogifts.me'];
const tokenRegex = /[\w-]{24}\.[\w-]{6}\.[\w-]{27}|mfa\.[\w-]{84}/;

// Memory map to track user message history for spam/duplicates: Map<userId, { content: string, count: number }>
const userMessageCache = new Map();

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const content = message.content.trim();
        const userId = message.author.id;

        // 1. Token Leak Protection
        if (tokenRegex.test(content)) {
            await message.delete().catch(() => {});
            await client.security.handleSecurityEvent(message.guild, message.author, 'TOKEN_LEAK', null, 'ban');
            return;
        }

        // 2. Scam Link Protection
        const isScam = scamDomains.some(domain => content.toLowerCase().includes(domain));
        if (isScam) {
            await message.delete().catch(() => {});
            await client.security.handleSecurityEvent(message.guild, message.author, 'SCAM_LINK', null, 'kick');
            return;
        }

        // 3. Anti-Duplicate Message / Spam Protection (Max 2 repeats allowed)
        const userLastMsg = userMessageCache.get(userId);
        
        if (userLastMsg && userLastMsg.content === content) {
            userLastMsg.count += 1;
            
            // Agar same message 2 baar se zyada (yani 3 ya usse zyada baar) bheja
            if (userLastMsg.count >= 3) {
                await message.delete().catch(() => {});
                
                // Warning ya temporary timeout de sakte hain, ya security event trigger kar sakte hain
                const permLevel = await client.security.verifyPermission(message.guild, message.author);
                if (permLevel === 'UNTRUSTED') {
                    await message.channel.send({ content: `<@${userId}>, please do not spam duplicate messages!` }).then(msg => {
                        setTimeout(() => msg.delete().catch(() => {}), 4000);
                    }).catch(() => {});
                }
                return;
            }
        } else {
            // Naya message hai toh cache update karo
            userMessageCache.set(userId, { content, count: 1 });
            
            // Memory leak bachane ke liye 30 seconds baad cache clear kar do us user ka
            setTimeout(() => {
                if (userMessageCache.has(userId)) {
                    userMessageCache.delete(userId);
                }
            }, 30000);
        }

        // 4. Untrusted Link / Invite Filter
        if (content.includes('http://') || content.includes('https://') || content.includes('discord.gg/')) {
            const permLevel = await client.security.verifyPermission(message.guild, message.author);
            if (permLevel === 'UNTRUSTED') {
                await message.delete().catch(() => {});
            }
        }
    }
};
