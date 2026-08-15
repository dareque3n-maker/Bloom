const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.AutoModerationExecution
    ]
});

// --- CLIENT READY & SLASH COMMAND REGISTRATION ---
client.once('ready', async () => {
    console.log(`Bot logged in as ${client.user.tag}!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Clears messages or entirely wipes the channel')
            .addIntegerOption(option => 
                option.setName('count')
                    .setDescription('Number of messages to delete (leave blank to wipe entire channel)')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('timeout')
            .setDescription('Timeout a member')
            .addUserOption(option => option.setName('user').setDescription('User to timeout').setRequired(true))
            .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Reason for timeout').setRequired(false))
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Started refreshing application (/) commands globally.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands globally.');
    } catch (error) {
        console.error(error);
    }
});

// --- 1. SMART CLEAR & TIMEOUT COMMAND HANDLER (Public Server Context) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Check if user is Server Owner or has Administrator/ManageMessages permission
    const isServerOwner = interaction.guild.ownerId === interaction.user.id;
    const hasStaffPerms = interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages) || 
                          interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!hasStaffPerms && !isServerOwner) {
        return interaction.reply({ content: "❌ You don't have permission to use this command!", ephemeral: true });
    }

    if (commandName === 'clear') {
        const count = interaction.options.getInteger('count');
        const channel = interaction.channel;

        await interaction.deferReply({ ephemeral: true });

        try {
            if (!count) {
                // Pura channel wipe karna (Clone and Delete old)
                const position = channel.position;
                const newChannel = await channel.clone({ position: position });
                await channel.delete();
                await newChannel.send(`✨ Channel has been completely wiped and refreshed by ${interaction.user.tag}`);
            } else {
                // Specific count delete
                if (count > 100 || count < 1) {
                    return interaction.editReply("Please provide a number between 1 and 100 for bulk deletion.");
                }
                await channel.bulkDelete(count, true);
                await interaction.editReply(`🗑️ Successfully cleared ${count} messages.`);
            }
        } catch (error) {
            console.error(error);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: "❌ Failed to clear messages. Make sure I have Manage Messages permission.", ephemeral: true });
            } else {
                await interaction.editReply("❌ Failed to clear messages.");
            }
        }
    } 
    
    else if (commandName === 'timeout') {
        const user = interaction.options.getMember('user');
        const minutes = interaction.options.getInteger('minutes');
        const reason = interaction.options.getString('reason') || "No reason provided";

        if (!user) return interaction.reply({ content: "User not found!", ephemeral: true });

        try {
            await user.timeout(minutes * 60 * 1000, reason);
            await interaction.reply({ content: `✅ Successfully timed out ${user.user.tag} for ${minutes} minutes. Reason: ${reason}` });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: "❌ Could not timeout this user. Check my role hierarchy.", ephemeral: true });
        }
    }
});

// --- 2. ANTI-NUKE: UNAUTHORIZED BOT ADD PROTECTION (Per-Server Owner Check) ---
client.on('guildMemberAdd', async member => {
    if (!member.user.bot) return;

    try {
        const fetchedLogs = await member.guild.fetchAuditLogs({
            limit: 1,
            type: 28, // Bot Add event type
        });
        const botAddLog = fetchedLogs.entries.first();

        if (botAddLog) {
            const { executor, target } = botAddLog;
            const guildOwnerId = member.guild.ownerId;

            // Agar bot add karne wala banda us server ka Owner nahi hai, toh bot ko ban kardo
            if (executor.id !== guildOwnerId) {
                await member.ban({ reason: "Unauthorized bot added by non-owner." });
                console.log(`[SECURITY] Unauthorized bot ${target.tag} banned in server ${member.guild.name}. Added by non-owner: ${executor.tag}`);
            }
        }
    } catch (err) {
        console.error("Error in anti-bot check:", err);
    }
});

// --- 3. AUTO-MOD: REPEAT WORD, LINK & IP BLOCKER ---
const userMessageHistory = new Map(); // Track spam/repeats

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // Staff bypass check
    if (message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    const content = message.content;
    const userId = message.author.id;
    const channel = message.channel;

    // A. Link Blocker & IP Share Blocker (Regex check)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/; // IP:Port pattern

    if (urlRegex.test(content) || ipRegex.test(content)) {
        try {
            await message.delete();
            await message.member.timeout(10 * 60 * 1000, "Sharing links or IP addresses is prohibited.");
            const warningMsg = await channel.send(`⚠️ ${message.author}, links and IP sharing are not allowed! You have been timed out for 10 minutes.`);
            setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
            return;
        } catch (e) {
            console.error("Failed to delete link/IP message:", e);
        }
    }

    // B. Word Repetition Filter (2 se zyada baar same message repeat na ho)
    const now = Date.now();
    if (!userMessageHistory.has(userId)) {
        userMessageHistory.set(userId, { text: content, count: 1, time: now });
    } else {
        const userData = userMessageHistory.get(userId);
        // Agar 10 seconds ke andar same message dobara bheja
        if (userData.text === content && (now - userData.time) < 10000) {
            userData.count += 1;
            userMessageHistory.set(userId, userData);

            if (userData.count >= 2) {
                try {
                    await message.delete();
                    await message.member.timeout(5 * 60 * 1000, "Spamming repeated words.");
                    const spamWarn = await channel.send(`⚠️ ${message.author}, stop repeating the same text! Timed out for 5 minutes.`);
                    setTimeout(() => spamWarn.delete().catch(() => {}), 5000);
                    userData.count = 0; // Reset
                } catch (e) {
                    console.error("Failed to handle repeat spam:", e);
                }
                return;
            }
        } else {
            userMessageHistory.set(userId, { text: content, count: 1, time: now });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
