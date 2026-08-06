const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Bot ready ho gaya hai: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // Bot ke khud ke messages ko ignore karo
    if (message.author.bot) return;

    // Check karo ki command '!logs' hai ya nahi
    if (message.content === '!logs') {
        try {
            // Check karo ki command server ke andar use hui hai ya nahi
            if (!message.guild) {
                return message.reply('Yeh command sirf server ke andar kaam karegi!');
            }

            await message.reply('⏳ Transcript generate ho raha hai, thoda wait karo...');

            // Channel se last 100 messages fetch karo (Limit apne hisab se badha sakte ho)
            const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
            
            // Transcript ka content format karo
            let transcript = `--- Transcript for #${message.channel.name} in ${message.guild.name} ---\n`;
            transcript += `Generated at: ${new Date().toLocaleString()}\n\n`;

            // Messages ko oldest se newest order me arrange karo
            const sortedMessages = Array.from(fetchedMessages.values()).reverse();

            sortedMessages.forEach(msg => {
                const time = new Date(msg.createdTimestamp).toLocaleString();
                transcript += `[${time}] ${msg.author.tag}: ${msg.content}\n`;
                if (msg.attachments.size > 0) {
                    msg.attachments.forEach(att => {
                        transcript += `[Attachment]: ${att.url}\n`;
                    });
                }
            });

            // Ek temporary text file banao
            const fileName = `transcript-${message.channel.name}-${Date.now()}.txt`;
            fs.writeFileSync(fileName, transcript, 'utf-8');

            // Server ka owner fetch karo
            const owner = await message.guild.fetchOwner();

            // File ko owner ke DM me bhejo
            const attachment = new AttachmentBuilder(fileName);
            await owner.send({
                content: `📄 **${message.guild.name}** server ke #${message.channel.name} channel ka transcript yahi hai!`,
                files: [attachment]
            });

            // Local folder se temporary file delete kar do
            fs.unlinkSync(fileName);

            await message.channel.send('✅ Transcript successfully server owner ke DM me bhej diya gaya hai!');

        } catch (error) {
            console.error(error);
            message.channel.send('❌ Transcript banane ya DM bhejne me koi error aa gaya hai!');
        }
    }
});

// Bot token .env file se load hoga
client.login(process.env.TOKEN);
      
