const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    AuditLogEvent, 
    ChannelType 
} = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences
    ]
});

const PREFIX = '$';

// --- IN-MEMORY DATABASE / STATE STORAGE ---
const guildData = new Map(); // guildId -> { antinuke, automod, autorole, autoroleId, verifyRoleId, logChannelId, extraOwners: [], whitelisted: [], repeatLimit }
const userWarnings = new Map(); // `${guildId}-${userId}` -> count
const spamBucket = new Map();   // `${guildId}-${userId}` -> [timestamps]
const repeatTracker = new Map(); // `${guildId}-${userId}` -> { text, count, time }

// Default guild config generator
function getGuildSettings(guildId) {
    if (!guildData.has(guildId)) {
        guildData.set(guildId, {
            antinuke: true,
            automod: true,
            autorole: false,
            autoroleId: null,
            verifyRoleId: null,
            logChannelId: null,
            extraOwners: [],
            whitelisted: [],
            repeatLimit: 2
        });
    }
    return guildData.get(guildId);
}

// Harmful Permissions list
const HARMFUL_PERMISSIONS = [
    PermissionsBitField.Flags.Administrator,
    PermissionsBitField.Flags.ManageGuild,
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.ManageChannels,
    PermissionsBitField.Flags.ManageWebhooks
];

// Permission Helper
function isHighAuthority(guild, userId) {
    if (guild.ownerId === userId) return true;
    const settings = getGuildSettings(guild.id);
    return settings.extraOwners.includes(userId);
}

function isWhitelisted(guild, userId) {
    if (isHighAuthority(guild, userId)) return true;
    const settings = getGuildSettings(guild.id);
    return settings.whitelisted.includes(userId);
}

// Centralized Logging Helper
async function sendModLog(guild, embed) {
    const settings = getGuildSettings(guild.id);
    let logChannel = null;
    if (settings.logChannelId) {
        logChannel = guild.channels.cache.get(settings.logChannelId);
    }
    if (!logChannel) {
        logChannel = guild.channels.cache.find(c => c.name === 'mod-logs' || c.name === 'logs');
    }
    if (logChannel && logChannel.isTextBased()) {
        try {
            await logChannel.send({ embeds: [embed] });
        } catch (e) {
            console.error("Failed to send log embed:", e);
        }
    }
}

// --- READY EVENT ---
client.once('ready', () => {
    console.log(`[ONLINE] ${client.user.tag} is protecting servers with prefix ${PREFIX}`);
    client.user.setActivity(`Security Engine | ${PREFIX}panel`, { type: 3 });
});

// --- INTERACTIVE PANEL BUILDER ---
function generatePanelMessage(guild) {
    const settings = getGuildSettings(guild.id);

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guild.name} Security & Settings Control Panel`)
        .setColor(0x2f3136)
        .setDescription(
            `**Bot Control & Modules Overview**\n\n` +
            `🔴 **Antinuke Security:** ${settings.antinuke ? '🔛 `ENABLED`' : '📴 `DISABLED`'}\n` +
            `🔴 **Auto-Moderation:** ${settings.automod ? '🔛 `ENABLED`' : '📴 `DISABLED`'}\n` +
            `🔴 **Auto-Role System:** ${settings.autorole ? '🔛 `ENABLED`' : '📴 `DISABLED`'} ${settings.autoroleId ? `(<@&${settings.autoroleId}>)` : '(Not Set)'}\n` +
            `🔴 **Verification Role:** ${settings.verifyRoleId ? `<@&${settings.verifyRoleId}>` : '`Not Set`'}\n` +
            `🔴 **Log Channel:** ${settings.logChannelId ? `<#${settings.logChannelId}>` : '`Auto / Not Set`'}\n\n` +
            `*Use the buttons below to toggle modules directly, or use the dropdown to configure roles & limits.*`
        )
        .setFooter({ text: "Restricted to Server Owner & Extra Owners" })
        .setTimestamp();

    // Toggle Buttons Row
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_toggle_antinuke')
            .setLabel(`Antinuke`)
            .setEmoji(settings.antinuke ? '🔛' : '📴')
            .setStyle(settings.antinuke ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('btn_toggle_automod')
            .setLabel(`Automod`)
            .setEmoji(settings.automod ? '🔛' : '📴')
            .setStyle(settings.automod ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('btn_toggle_autorole')
            .setLabel(`AutoRole`)
            .setEmoji(settings.autorole ? '🔛' : '📴')
            .setStyle(settings.autorole ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    // Dropdown Configuration Menu
    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('panel_select_config')
            .setPlaceholder('⚙️ Select a setting to configure...')
            .addOptions([
                { label: 'View Whitelist & Extra Owners', description: 'See who has access to security permissions', value: 'cfg_view_wl', emoji: '👑' },
                { label: 'Setup Verification Gatekeeper', description: 'Send verification button to current channel', value: 'cfg_send_verify', emoji: '✅' },
                { label: 'Set Current Channel as Log Channel', description: 'Route all server audit logs here', value: 'cfg_set_log_channel', emoji: '📜' },
                { label: 'Reset Antinuke Config', description: 'Disable and clear cached flags', value: 'cfg_reset_antinuke', emoji: '🔄' }
            ])
    );

    return { embeds: [embed], components: [buttonRow, selectMenu] };
}

// --- MESSAGE EVENT: COMMANDS & HIGH-SPEED AUTO-MOD ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const settings = getGuildSettings(message.guild.id);
    const userId = message.author.id;
    const now = Date.now();

    // ================= 1. HIGH-SPEED AUTOMOD ENGINE =================
    if (settings.automod && !isWhitelisted(message.guild, userId)) {
        const content = message.content.trim();

        // A. Millisecond Bucket Anti-Spam (More than 4 messages in 2.5 seconds)
        const trackerKey = `${message.guild.id}-${userId}`;
        if (!spamBucket.has(trackerKey)) spamBucket.set(trackerKey, []);
        const userTimestamps = spamBucket.get(trackerKey);
        userTimestamps.push(now);
        const filteredTimestamps = userTimestamps.filter(t => now - t < 2500);
        spamBucket.set(trackerKey, filteredTimestamps);

        if (filteredTimestamps.length > 4) {
            try {
                await message.delete();
                await message.member.timeout(10 * 60 * 1000, "High-speed message spam detected.");
                const warn = await message.channel.send(`⚠️ ${message.author}, spamming is strictly forbidden! Timed out for 10 minutes.`);
                setTimeout(() => warn.delete().catch(() => {}), 4000);
                spamBucket.set(trackerKey, []);
                return;
            } catch (e) {}
        }

        // B. Repeated Message / Word Check (2x limit)
        if (!repeatTracker.has(trackerKey)) {
            repeatTracker.set(trackerKey, { text: content, count: 1, time: now });
        } else {
            const data = repeatTracker.get(trackerKey);
            if (data.text === content && (now - data.time) < 15000) {
                data.count += 1;
                repeatTracker.set(trackerKey, data);
                if (data.count >= 2) {
                    try {
                        await message.delete();
                        await message.member.timeout(5 * 60 * 1000, "Repeated text limit exceeded.");
                        const warn = await message.channel.send(`⚠️ ${message.author}, do not repeat the same text! Timed out for 5 minutes.`);
                        setTimeout(() => warn.delete().catch(() => {}), 4000);
                        repeatTracker.set(trackerKey, { text: '', count: 0, time: 0 });
                        return;
                    } catch (e) {}
                }
            } else {
                repeatTracker.set(trackerKey, { text: content, count: 1, time: now });
            }
        }

        // C. Link & IP Blocker
        const linkRegex = /(https?:\/\/[^\s]+)/gi;
        const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/;
        if (linkRegex.test(content) || ipRegex.test(content)) {
            try {
                await message.delete();
                await message.member.timeout(15 * 60 * 1000, "Posting prohibited links or IP addresses.");
                const warn = await message.channel.send(`⚠️ ${message.author}, links and IP sharing are not allowed! Timed out for 15 minutes.`);
                setTimeout(() => warn.delete().catch(() => {}), 4000);
                return;
            } catch (e) {}
        }
    }

    // ================= 2. PREFIX COMMAND HANDLER =================
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- COMMAND: $panel ---
    if (command === 'panel') {
        if (!isHighAuthority(message.guild, message.author.id)) {
            return message.reply("❌ Only the **Server Owner** or **Extra Owners** can access the security control panel.");
        }
        return message.reply(generatePanelMessage(message.guild));
    }

    // --- COMMAND: $extraowner (add/remove/list) ---
    if (command === 'extraowner') {
        if (message.guild.ownerId !== message.author.id) {
            return message.reply("❌ Only the main **Server Owner** can manage Extra Owners!");
        }

        const sub = args[0]?.toLowerCase();
        const target = message.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);

        if (sub === 'add' && target) {
            if (settings.extraOwners.includes(target.id)) return message.reply("⚠️ User is already an Extra Owner.");
            settings.extraOwners.push(target.id);
            return message.reply(`👑 Successfully added **${target.tag}** as an Extra Owner.`);
        } else if (sub === 'remove' && target) {
            settings.extraOwners = settings.extraOwners.filter(id => id !== target.id);
            return message.reply(`🗑️ Removed **${target.tag}** from Extra Owners.`);
        } else if (sub === 'list') {
            if (!settings.extraOwners.length) return message.reply("ℹ️ No Extra Owners configured.");
            const ownersList = settings.extraOwners.map(id => `<@${id}> (${id})`).join('\n');
            return message.reply({ embeds: [new EmbedBuilder().setTitle("👑 Extra Owners List").setColor(0xffcc00).setDescription(ownersList)] });
        } else {
            return message.reply(`Usage: \`${PREFIX}extraowner add @user\` | \`${PREFIX}extraowner remove @user\` | \`${PREFIX}extraowner list\``);
        }
    }

    // --- COMMAND: $wl (add/remove/list) ---
    if (command === 'wl' || command === 'whitelist') {
        if (!isHighAuthority(message.guild, message.author.id)) {
            return message.reply("❌ Only Server Owner and Extra Owners can manage Whitelist.");
        }

        const sub = args[0]?.toLowerCase();
        const target = message.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);

        if (sub === 'add' && target) {
            if (settings.whitelisted.includes(target.id)) return message.reply("⚠️ User is already whitelisted.");
            settings.whitelisted.push(target.id);
            return message.reply(`🛡️ Added **${target.tag}** to Whitelist.`);
        } else if (sub === 'remove' && target) {
            settings.whitelisted = settings.whitelisted.filter(id => id !== target.id);
            return message.reply(`🗑️ Removed **${target.tag}** from Whitelist.`);
        } else if (sub === 'list') {
            if (!settings.whitelisted.length) return message.reply("ℹ️ No users in Whitelist.");
            const wlList = settings.whitelisted.map(id => `<@${id}> (${id})`).join('\n');
            return message.reply({ embeds: [new EmbedBuilder().setTitle("🛡️ Whitelisted Users").setColor(0x00ff00).setDescription(wlList)] });
        } else {
            return message.reply(`Usage: \`${PREFIX}wl add @user\` | \`${PREFIX}wl remove @user\` | \`${PREFIX}wl list\``);
        }
    }

    // --- COMMAND: $clear ---
    if (command === 'clear') {
        if (!isWhitelisted(message.guild, message.author.id) && !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply("❌ You don't have permission to execute clear.");
        }

        const countArg = args[0];
        const channel = message.channel;

        try {
            if (!countArg) {
                // Channel wipe & clone
                const position = channel.position;
                const newChannel = await channel.clone({ position: position });
                await channel.delete();
                await newChannel.send(`✨ Channel has been completely wiped and refreshed by ${message.author.tag}`);
            } else {
                const count = parseInt(countArg);
                if (isNaN(count) || count < 1 || count > 100) return message.reply("Provide a valid count between 1 and 100.");
                await channel.bulkDelete(count, true);
                const replyMsg = await channel.send(`🗑️ Deleted ${count} messages.`);
                setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            }
        } catch (e) {
            console.error(e);
            message.reply("❌ Failed to clear messages. Check my permissions.");
        }
    }

    // --- COMMAND: $warn ---
    if (command === 'warn') {
        if (!isWhitelisted(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        if (!target) return message.reply(`Usage: \`${PREFIX}warn @user [reason]\``);
        const reason = args.slice(1).join(' ') || "No reason provided";

        const warnKey = `${message.guild.id}-${target.id}`;
        const count = (userWarnings.get(warnKey) || 0) + 1;
        userWarnings.set(warnKey, count);

        message.reply(`⚠️ **${target.user.tag}** has been warned! Total Warnings: **${count}/3**`);
        if (count >= 3) {
            try {
                await target.ban({ reason: "Exceeded 3 automated warnings." });
                message.channel.send(`🚨 **${target.user.tag}** has been automatically banned for reaching 3 warnings.`);
                userWarnings.delete(warnKey);
            } catch (e) {
                message.channel.send(`❌ Could not auto-ban member. Check role hierarchy.`);
            }
        }
    }

    // --- COMMAND: $ban, $unban, $kick, $mute, $unmute ---
    if (command === 'ban') {
        if (!isWhitelisted(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply(`Usage: \`${PREFIX}ban @user [reason]\``);
        const reason = args.slice(1).join(' ') || "Banned by Moderator";
        try {
            await target.ban({ reason });
            message.reply(`🔨 Successfully banned **${target.user.tag}**.`);
        } catch (e) {
            message.reply("❌ Failed to ban. Ensure my bot role is higher than the target.");
        }
    }

    if (command === 'unban') {
        if (!isWhitelisted(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const userId = args[0];
        if (!userId) return message.reply(`Usage: \`${PREFIX}unban <user_id>\``);
        try {
            await message.guild.members.unban(userId);
            message.reply(`✅ Successfully unbanned user ID: \`${userId}\``);
        } catch (e) {
            message.reply("❌ Failed to unban. Ensure the ID is valid and banned.");
        }
    }

    if (command === 'kick') {
        if (!isWhitelisted(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        if (!target) return message.reply(`Usage: \`${PREFIX}kick @user [reason]\``);
        const reason = args.slice(1).join(' ') || "Kicked by Moderator";
        try {
            await target.kick(reason);
            message.reply(`👢 Successfully kicked **${target.user.tag}**.`);
        } catch (e) {
            message.reply("❌ Failed to kick. Check role hierarchy.");
        }
    }

    if (command === 'mute' || command === 'timeout') {
        if (!isWhitelisted(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        const minutes = parseInt(args[1]) || 10;
        if (!target) return message.reply(`Usage: \`${PREFIX}mute @user <minutes> [reason]\``);
        const reason = args.slice(2).join(' ') || "Muted by Staff";
        try {
            await target.timeout(minutes * 60 * 1000, reason);
            message.reply(`🔇 Muted **${target.user.tag}** for **${minutes} minutes**.`);
        } catch (e) {
            message.reply("❌ Failed to mute. Check permissions.");
        }
    }

    if (command === 'unmute') {
        if (!isWhitelisted(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        if (!target) return message.reply(`Usage: \`${PREFIX}unmute @user\``);
        try {
            await target.timeout(null, "Unmuted by Staff");
            message.reply(`🔊 Unmuted **${target.user.tag}**.`);
        } catch (e) {
            message.reply("❌ Failed to unmute.");
        }
    }

    // --- COMMAND: $autorole ---
    if (command === 'autorole') {
        if (!isHighAuthority(message.guild, message.author.id)) return message.reply("❌ Only Owners can set Auto-Role.");
        const role = message.mentions.roles.first();
        if (!role) return message.reply(`Usage: \`${PREFIX}autorole @role\``);
        settings.autoroleId = role.id;
        settings.autorole = true;
        message.reply(`✅ Auto-Role set to **${role.name}** and enabled.`);
    }
});

// --- COMPONENT INTERACTIONS (PANEL BUTTONS, DROPDOWNS & VERIFICATION) ---
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const { customId, guild, user } = interaction;

        // Verification Gatekeeper Button Click
        if (customId === 'btn_gatekeeper_verify') {
            const settings = getGuildSettings(guild.id);
            if (!settings.verifyRoleId) {
                return interaction.reply({ content: "❌ Verification role is not configured by staff yet!", ephemeral: true });
            }
            const verifyRole = guild.roles.cache.get(settings.verifyRoleId);
            if (!verifyRole) {
                return interaction.reply({ content: "❌ Verified role not found on the server!", ephemeral: true });
            }
            try {
                await interaction.member.roles.add(verifyRole);
                return interaction.reply({ content: "✅ You have been successfully verified! All server channels are now unlocked.", ephemeral: true });
            } catch (e) {
                return interaction.reply({ content: "❌ Could not grant role. Please contact Server Admins.", ephemeral: true });
            }
        }

        // Security Panel Toggle Buttons
        if (customId.startsWith('btn_toggle_')) {
            if (!isHighAuthority(guild, user.id)) {
                return interaction.reply({ content: "❌ You don't have authority to toggle security modules.", ephemeral: true });
            }
            const settings = getGuildSettings(guild.id);
            if (customId === 'btn_toggle_antinuke') settings.antinuke = !settings.antinuke;
            if (customId === 'btn_toggle_automod') settings.automod = !settings.automod;
            if (customId === 'btn_toggle_autorole') settings.autorole = !settings.autorole;

            return interaction.update(generatePanelMessage(guild));
        }
    }

    if (interaction.isStringSelectMenu()) {
        const { customId, guild, user, values } = interaction;

        if (customId === 'panel_select_config') {
            if (!isHighAuthority(guild, user.id)) {
                return interaction.reply({ content: "❌ Permission Denied.", ephemeral: true });
            }

            const selection = values[0];
            const settings = getGuildSettings(guild.id);

            if (selection === 'cfg_view_wl') {
                const owners = settings.extraOwners.map(id => `<@${id}>`).join(', ') || 'None';
                const wl = settings.whitelisted.map(id => `<@${id}>`).join(', ') || 'None';
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("🛡️ Authority & Whitelist Roster")
                            .setColor(0x00aaff)
                            .addFields(
                                { name: "👑 Extra Owners", value: owners },
                                { name: "🛡️ Whitelisted Members", value: wl }
                            )
                    ],
                    ephemeral: true
                });
            }

            if (selection === 'cfg_send_verify') {
                // Send verify embed with button in current channel
                const verifyEmbed = new EmbedBuilder()
                    .setTitle("🛡️ Server Verification Gatekeeper")
                    .setColor(0x00ff88)
                    .setDescription("Click the button below to verify your account and gain full access to the server channels.")
                    .setFooter({ text: "Anti-Raid Protection" });

                const verifyRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_gatekeeper_verify')
                        .setLabel('Verify Account')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅')
                );

                await interaction.channel.send({ embeds: [verifyEmbed], components: [verifyRow] });
                return interaction.reply({ content: "✅ Verification message deployed to this channel!", ephemeral: true });
            }

            if (selection === 'cfg_set_log_channel') {
                settings.logChannelId = interaction.channel.id;
                await interaction.update(generatePanelMessage(guild));
                return interaction.followUp({ content: `📜 This channel (<#${interaction.channel.id}>) has been set as the central Log Channel!`, ephemeral: true });
            }

            if (selection === 'cfg_reset_antinuke') {
                settings.antinuke = false;
                settings.whitelisted = [];
                await interaction.update(generatePanelMessage(guild));
                return interaction.followUp({ content: "🔄 Antinuke has been reset and disabled.", ephemeral: true });
            }
        }
    }
});

// ================= 3. ANTI-NUKE & HARMFUL PERMISSION ENFORCERS =================

// A. Unauthorized Bot Add Protection (Strict Owner & Extra Owner Check)
client.on('guildMemberAdd', async member => {
    const settings = getGuildSettings(member.guild.id);

    // If human & autorole enabled
    if (!member.user.bot && settings.autorole && settings.autoroleId) {
        const role = member.guild.roles.cache.get(settings.autoroleId);
        if (role) member.roles.add(role).catch(() => {});
    }

    // Join Log
    const joinEmbed = new EmbedBuilder()
        .setTitle('📥 Member Joined')
        .setColor(0x00ff00)
        .setDescription(`${member.user.tag} (${member.id}) joined the server.`)
        .setTimestamp();
    sendModLog(member.guild, joinEmbed);

    // Bot Add Anti-Nuke Check
    if (member.user.bot && settings.antinuke) {
        try {
            const auditLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd });
            const entry = auditLogs.entries.first();

            if (entry) {
                const { executor, target } = entry;
                if (target.id === member.id && !isHighAuthority(member.guild, executor.id)) {
                    // Instant ban unauthorized bot & penalize executor
                    await member.ban({ reason: "Anti-Nuke: Unauthorized bot addition." });
                    const executorMember = await member.guild.members.fetch(executor.id).catch(() => null);
                    if (executorMember && executorMember.bannable) {
                        await executorMember.ban({ reason: "Anti-Nuke: Added unauthorized bot without owner permission." });
                    }

                    const alertEmbed = new EmbedBuilder()
                        .setTitle("🚨 CRITICAL ANTI-NUKE TRIGGER")
                        .setColor(0xff0000)
                        .setDescription(`Unauthorized bot **${member.user.tag}** was added by **${executor.tag}**.\n**Action:** Both the Bot and the Executor have been banned.`)
                        .setTimestamp();
                    sendModLog(member.guild, alertEmbed);
                }
            }
        } catch (e) {
            console.error("Anti-bot audit check error:", e);
        }
    }
});

// B. Harmful Permission Guard (Role Updates & Member Role Additions)
client.on('roleUpdate', async (oldRole, newRole) => {
    const settings = getGuildSettings(newRole.guild.id);
    if (!settings.antinuke) return;

    if (newRole.permissions.has(HARMFUL_PERMISSIONS)) {
        try {
            const auditLogs = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
            const entry = auditLogs.entries.first();
            if (entry && !isHighAuthority(newRole.guild, entry.executor.id)) {
                await newRole.setPermissions(0n, "Harmful permissions automatically stripped by Bot Guard.");
                const alert = new EmbedBuilder()
                    .setTitle("🛡️ Harmful Permissions Stripped")
                    .setColor(0xff0000)
                    .setDescription(`Role **${newRole.name}** was granted Administrator/Harmful perms by **${entry.executor.tag}**. Permissions were immediately revoked!`)
                    .setTimestamp();
                sendModLog(newRole.guild, alert);
            }
        } catch (e) {
            console.error("Failed to strip harmful perms:", e);
        }
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const settings = getGuildSettings(newMember.guild.id);
    if (!settings.antinuke) return;

    // Nickname Change Logger
    if (oldMember.nickname !== newMember.nickname) {
        const nickEmbed = new EmbedBuilder()
            .setTitle('✏️ Nickname Changed')
            .setColor(0x3498db)
            .setDescription(`**${newMember.user.tag}** changed nickname.\n**Old:** ${oldMember.nickname || 'None'}\n**New:** ${newMember.nickname || 'None'}`)
            .setTimestamp();
        sendModLog(newMember.guild, nickEmbed);
    }

    // Role assignment check for harmful perms
    if (!isWhitelisted(newMember.guild, newMember.id) && newMember.permissions.has(HARMFUL_PERMISSIONS)) {
        const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id) && r.permissions.has(HARMFUL_PERMISSIONS));
        if (addedRoles.size > 0) {
            try {
                await newMember.roles.remove(addedRoles, "Harmful permission role removed from non-whitelisted user.");
                const alert = new EmbedBuilder()
                    .setTitle("🛡️ Unauthorized Dangerous Role Revoked")
                    .setColor(0xff0000)
                    .setDescription(`Removed dangerous roles from **${newMember.user.tag}** as they are not Whitelisted or Extra Owner.`)
                    .setTimestamp();
                sendModLog(newMember.guild, alert);
            } catch (e) {}
        }
    }
});

// ================= 4. A-TO-Z AUDIT LOGGERS =================

// Channel Create / Delete / Update Logs
client.on('channelCreate', async channel => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle('📁 Channel Created')
        .setColor(0x2ecc71)
        .setDescription(`Channel **#${channel.name}** was created.`)
        .setTimestamp();
    sendModLog(channel.guild, embed);
});

client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle('🗑️ Channel Deleted')
        .setColor(0xe74c3c)
        .setDescription(`Channel **#${channel.name}** was deleted.`)
        .setTimestamp();
    sendModLog(channel.guild, embed);
});

// Role Create / Delete Logs
client.on('roleCreate', async role => {
    const embed = new EmbedBuilder()
        .setTitle('✨ Role Created')
        .setColor(0x2ecc71)
        .setDescription(`Role **${role.name}** was created.`)
        .setTimestamp();
    sendModLog(role.guild, embed);
});

client.on('roleDelete', async role => {
    const embed = new EmbedBuilder()
        .setTitle('🗑️ Role Deleted')
        .setColor(0xe74c3c)
        .setDescription(`Role **${role.name}** was deleted.`)
        .setTimestamp();
    sendModLog(role.guild, embed);
});

// Member Leave & Kick Logs
client.on('guildMemberRemove', async member => {
    let description = `**${member.user.tag}** left the server.`;
    try {
        const audit = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
        const kickLog = audit.entries.first();
        if (kickLog && kickLog.target.id === member.id && (Date.now() - kickLog.createdTimestamp < 5000)) {
            description = `👢 **${member.user.tag}** was **Kicked** by **${kickLog.executor.tag}**.\nReason: ${kickLog.reason || 'No reason provided'}`;
        }
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('📤 Member Removed / Left')
        .setColor(0xe67e22)
        .setDescription(description)
        .setTimestamp();
    sendModLog(member.guild, embed);
});

// Message Delete Log
client.on('messageDelete', async message => {
    if (!message.guild || message.author?.bot) return;
    const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .setColor(0xe74c3c)
        .addFields(
            { name: 'Author', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Message Content', value: message.content ? (message.content.length > 1000 ? message.content.substring(0, 1000) + '...' : message.content) : '[Attachment/Embed Only]' }
        )
        .setTimestamp();
    sendModLog(message.guild, embed);
});

client.login(process.env.DISCORD_TOKEN);
