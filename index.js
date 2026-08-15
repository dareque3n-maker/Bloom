const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    AuditLogEvent 
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

// In-Memory Enterprise Storage
const guildDatabase = new Map(); 
const userWarnings = new Map(); 
const spamBucket = new Map();   
const repeatTracker = new Map(); 

function getGuildConfig(guildId) {
    if (!guildDatabase.has(guildId)) {
        guildDatabase.set(guildId, {
            antinuke: true,
            automod: true,
            autorole: false,
            autoroleId: null,
            verifyRoleId: null,
            logChannelId: null,
            extraOwners: [],
            whitelisted: [],
            repeatLimit: 2,
            lockdown: false
        });
    }
    return guildDatabase.get(guildId);
}

const DANGEROUS_PERMS = [
    PermissionsBitField.Flags.Administrator,
    PermissionsBitField.Flags.ManageGuild,
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.ManageChannels,
    PermissionsBitField.Flags.ManageWebhooks
];

function isOwnerOrExtra(guild, userId) {
    if (guild.ownerId === userId) return true;
    const config = getGuildConfig(guild.id);
    return config.extraOwners.includes(userId);
}

function isWhitelistedUser(guild, userId) {
    if (isOwnerOrExtra(guild, userId)) return true;
    const config = getGuildConfig(guild.id);
    return config.whitelisted.includes(userId);
}

async function dispatchLog(guild, embed) {
    const config = getGuildConfig(guild.id);
    let channel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : null;
    if (!channel) {
        channel = guild.channels.cache.find(c => c.name === 'logs' || c.name === 'mod-logs');
    }
    if (channel && channel.isTextBased()) {
        try { await channel.send({ embeds: [embed] }); } catch (e) {}
    }
}

client.once('ready', () => {
    console.log(`[SECURE ENGINE] Bot is online as ${client.user.tag}`);
    client.user.setActivity(`Guarding Servers | ${PREFIX}panel`, { type: 3 });
});

// --- PANEL GENERATOR (BUTTONS + DROPDOWN) ---
function buildMainPanel(guild) {
    const cfg = getGuildConfig(guild.id);

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${guild.name} • Security & Management Control Panel`)
        .setColor(0x2f3136)
        .setDescription(
            `**Modules Overview & Current Status:**\n\n` +
            `🔴 **Antinuke Security:** ${cfg.antinuke ? '🔛 `ENABLED`' : '📴 `DISABLED`'}\n` +
            `🔴 **Auto-Moderation:** ${cfg.automod ? '🔛 `ENABLED`' : '📴 `DISABLED`'}\n` +
            `🔴 **Auto-Role System:** ${cfg.autorole ? '🔛 `ENABLED`' : '📴 `DISABLED`'} ${cfg.autoroleId ? `(<@&${cfg.autoroleId}>)` : ''}\n` +
            `🔴 **Verification Role:** ${cfg.verifyRoleId ? `<@&${cfg.verifyRoleId}>` : '`Not Set`'}\n` +
            `🔴 **Logs Channel:** ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : '`Default (logs)`'}\n\n` +
            `*Use the buttons below to toggle modules directly, or select options from the dropdown menu.*`
        )
        .setFooter({ text: "Restricted Control: Server Owner & Extra Owners Only" })
        .setTimestamp();

    const togglesRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tog_antinuke').setLabel('Antinuke').setEmoji(cfg.antinuke ? '🔛' : '📴').setStyle(cfg.antinuke ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('tog_automod').setLabel('Automod').setEmoji(cfg.automod ? '🔛' : '📴').setStyle(cfg.automod ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('tog_autorole').setLabel('AutoRole').setEmoji(cfg.autorole ? '🔛' : '📴').setStyle(cfg.autorole ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('panel_dropdown_menu')
            .setPlaceholder('⚙️ Select module setup to configure...')
            .addOptions([
                { label: 'View Whitelist & Extra Owners', description: 'Inspect authorized security personnel', value: 'menu_view_wl', emoji: '👑' },
                { label: 'Setup Verification Gatekeeper', description: 'Deploy verification button in current channel', value: 'menu_setup_verify', emoji: '✅' },
                { label: 'Set Current Channel as Logs', description: 'Route all A-Z server logs here', value: 'menu_set_logs', emoji: '📜' },
                { label: 'Emergency Server Lockdown', description: 'Toggle complete message restriction across server', value: 'menu_lockdown', emoji: '🔒' }
            ])
    );

    return { embeds: [embed], components: [togglesRow, menuRow] };
}

// --- AUTOMOD & PREFIX COMMAND ENGINE ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const cfg = getGuildConfig(message.guild.id);
    const userId = message.author.id;
    const now = Date.now();

    // 1. High-Speed Automod Filter
    if (cfg.automod && !isWhitelistedUser(message.guild, userId)) {
        const text = message.content.trim();
        const key = `${message.guild.id}-${userId}`;

        // Millisecond Spam Bucket
        if (!spamBucket.has(key)) spamBucket.set(key, []);
        const stamps = spamBucket.get(key);
        stamps.push(now);
        const validStamps = stamps.filter(t => now - t < 2500);
        spamBucket.set(key, validStamps);

        if (validStamps.length > 4) {
            try {
                await message.delete();
                await message.member.timeout(10 * 60 * 1000, "Automod: Rapid spamming detected.");
                const w = await message.channel.send(`⚠️ ${message.author}, spamming is restricted! Timed out for 10 minutes.`);
                setTimeout(() => w.delete().catch(() => {}), 4000);
                spamBucket.set(key, []);
                return;
            } catch (e) {}
        }

        // Repeat Message Filter (2x Limit + Deletion)
        if (!repeatTracker.has(key)) {
            repeatTracker.set(key, { text, count: 1, time: now });
        } else {
            const data = repeatTracker.get(key);
            if (data.text === text && (now - data.time) < 15000) {
                data.count += 1;
                repeatTracker.set(key, data);
                if (data.count >= 2) {
                    try {
                        await message.delete();
                        await message.member.timeout(5 * 60 * 1000, "Automod: Repeated text limit exceeded.");
                        const w = await message.channel.send(`⚠️ ${message.author}, do not repeat text messages! Timed out for 5 minutes.`);
                        setTimeout(() => w.delete().catch(() => {}), 4000);
                        repeatTracker.set(key, { text: '', count: 0, time: 0 });
                        return;
                    } catch (e) {}
                }
            } else {
                repeatTracker.set(key, { text, count: 1, time: now });
            }
        }

        // Link and IP Address Filter
        if (/(https?:\/\/[^\s]+)/gi.test(text) || /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/.test(text)) {
            try {
                await message.delete();
                await message.member.timeout(15 * 60 * 1000, "Automod: Prohibited links or IP address sharing.");
                const w = await message.channel.send(`⚠️ ${message.author}, links and IP sharing are not permitted! Timed out for 15 minutes.`);
                setTimeout(() => w.delete().catch(() => {}), 4000);
                return;
            } catch (e) {}
        }
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // Command: $panel
    if (cmd === 'panel') {
        if (!isOwnerOrExtra(message.guild, message.author.id)) {
            return message.reply("❌ Access Denied. Only Server Owner & Extra Owners can use the control panel.");
        }
        return message.reply(buildMainPanel(message.guild));
    }

    // Command: $extraowner
    if (cmd === 'extraowner') {
        if (message.guild.ownerId !== message.author.id) return message.reply("❌ Only the main Server Owner can manage Extra Owners!");
        const sub = args[0]?.toLowerCase();
        const target = message.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);

        if (sub === 'add' && target) {
            if (cfg.extraOwners.includes(target.id)) return message.reply("⚠️ User is already an Extra Owner.");
            cfg.extraOwners.push(target.id);
            return message.reply(`👑 Successfully added **${target.tag}** as Extra Owner.`);
        } else if (sub === 'remove' && target) {
            cfg.extraOwners = cfg.extraOwners.filter(id => id !== target.id);
            return message.reply(`🗑️ Removed **${target.tag}** from Extra Owners.`);
        } else if (sub === 'list') {
            if (!cfg.extraOwners.length) return message.reply("ℹ️ No Extra Owners configured.");
            return message.reply({ embeds: [new EmbedBuilder().setTitle("👑 Extra Owners Roster").setDescription(cfg.extraOwners.map(id => `<@${id}>`).join('\n'))] });
        } else {
            return message.reply(`Usage: \`${PREFIX}extraowner add/remove @user\` or \`${PREFIX}extraowner list\``);
        }
    }

    // Command: $wl
    if (cmd === 'wl' || cmd === 'whitelist') {
        if (!isOwnerOrExtra(message.guild, message.author.id)) return message.reply("❌ Permission Denied.");
        const sub = args[0]?.toLowerCase();
        const target = message.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);

        if (sub === 'add' && target) {
            if (cfg.whitelisted.includes(target.id)) return message.reply("⚠️ User already whitelisted.");
            cfg.whitelisted.push(target.id);
            return message.reply(`🛡️ Added **${target.tag}** to Whitelist.`);
        } else if (sub === 'remove' && target) {
            cfg.whitelisted = cfg.whitelisted.filter(id => id !== target.id);
            return message.reply(`🗑️ Removed **${target.tag}** from Whitelist.`);
        } else if (sub === 'list') {
            if (!cfg.whitelisted.length) return message.reply("ℹ️ Whitelist is empty.");
            return message.reply({ embeds: [new EmbedBuilder().setTitle("🛡️ Whitelisted Members").setDescription(cfg.whitelisted.map(id => `<@${id}>`).join('\n'))] });
        } else {
            return message.reply(`Usage: \`${PREFIX}wl add/remove @user\` or \`${PREFIX}wl list\``);
        }
    }

    // Command: $clear
    if (cmd === 'clear') {
        if (!isWhitelistedUser(message.guild, message.author.id) && !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply("❌ You lack permission to clear messages.");
        }
        const countArg = args[0];
        const ch = message.channel;
        try {
            if (!countArg) {
                const pos = ch.position;
                const newCh = await ch.clone({ position: pos });
                await ch.delete();
                await newCh.send(`✨ Channel completely wiped and reset by ${message.author.tag}`);
            } else {
                const count = parseInt(countArg);
                if (isNaN(count) || count < 1 || count > 100) return message.reply("Provide a number between 1 and 100.");
                await ch.bulkDelete(count, true);
                const r = await ch.send(`🗑️ Cleared ${count} messages.`);
                setTimeout(() => r.delete().catch(() => {}), 3000);
            }
        } catch (e) {
            message.reply("❌ Failed to clear messages.");
        }
    }

    // Command: $warn
    if (cmd === 'warn') {
        if (!isWhitelistedUser(message.guild, message.author.id)) return message.reply("❌ Permission Denied.");
        const target = message.mentions.members.first();
        if (!target) return message.reply(`Usage: \`${PREFIX}warn @user [reason]\``);
        const k = `${message.guild.id}-${target.id}`;
        const c = (userWarnings.get(k) || 0) + 1;
        userWarnings.set(k, c);
        message.reply(`⚠️ **${target.user.tag}** warned! Total Warnings: **${c}/3**`);
        if (c >= 3) {
            await target.ban({ reason: "Exceeded 3 automated warnings limit." }).catch(() => {});
            message.channel.send(`🚨 **${target.user.tag}** automatically banned for reaching 3 warnings.`);
            userWarnings.delete(k);
        }
    }

    // Moderation Suite ($ban, $unban, $kick, $mute, $unmute)
    if (cmd === 'ban') {
        if (!isWhitelistedUser(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply(`Usage: \`${PREFIX}ban @user [reason]\``);
        try { await target.ban({ reason: args.slice(1).join(' ') || "Banned by staff" }); message.reply(`🔨 Successfully banned **${target.user.tag}**.`); } catch (e) { message.reply("❌ Failed to ban."); }
    }

    if (cmd === 'unban') {
        if (!isWhitelistedUser(message.guild, message.author.id)) return message.reply("❌ No permission.");
        try { await message.guild.members.unban(args[0]); message.reply(`✅ Unbanned user ID: \`${args[0]}\``); } catch (e) { message.reply("❌ Failed to unban."); }
    }

    if (cmd === 'kick') {
        if (!isWhitelistedUser(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        if (!target) return message.reply(`Usage: \`${PREFIX}kick @user [reason]\``);
        try { await target.kick(args.slice(1).join(' ') || "Kicked by staff"); message.reply(`👢 Successfully kicked **${target.user.tag}**.`); } catch (e) { message.reply("❌ Failed to kick."); }
    }

    if (cmd === 'mute' || cmd === 'timeout') {
        if (!isWhitelistedUser(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        const mins = parseInt(args[1]) || 10;
        if (!target) return message.reply(`Usage: \`${PREFIX}mute @user <minutes>\``);
        try { await target.timeout(mins * 60 * 1000, "Muted by staff"); message.reply(`🔇 Muted **${target.user.tag}** for **${mins} minutes**.`); } catch (e) { message.reply("❌ Failed to mute."); }
    }

    if (cmd === 'unmute') {
        if (!isWhitelistedUser(message.guild, message.author.id)) return message.reply("❌ No permission.");
        const target = message.mentions.members.first();
        if (!target) return message.reply(`Usage: \`${PREFIX}unmute @user\``);
        try { await target.timeout(null, "Unmuted by staff"); message.reply(`🔊 Unmuted **${target.user.tag}**.`); } catch (e) { message.reply("❌ Failed to unmute."); }
    }

    // Command: $autorole setup
    if (cmd === 'autorole') {
        if (!isOwnerOrExtra(message.guild, message.author.id)) return message.reply("❌ Owner only command.");
        const role = message.mentions.roles.first();
        if (!role) return message.reply(`Usage: \`${PREFIX}autorole @role\``);
        cfg.autoroleId = role.id;
        cfg.autorole = true;
        message.reply(`✅ Auto-role successfully configured to **${role.name}**.`);
    }
});

// --- PANEL, DROPDOWN & VERIFICATION INTERACTIONS ---
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const { customId, guild, user } = interaction;

        // Verification Gatekeeper Button Trigger
        if (customId === 'btn_verify_click') {
            const cfg = getGuildConfig(guild.id);
            if (!cfg.verifyRoleId) return interaction.reply({ content: "❌ Verification role is not set by staff yet!", ephemeral: true });
            const role = guild.roles.cache.get(cfg.verifyRoleId);
            if (!role) return interaction.reply({ content: "❌ Verification role not found.", ephemeral: true });
            try {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: "✅ You have successfully verified your account!", ephemeral: true });
            } catch (e) {
                return interaction.reply({ content: "❌ Failed to assign role. Check bot hierarchy.", ephemeral: true });
            }
        }

        // Panel Toggle Buttons
        if (customId.startsWith('tog_')) {
            if (!isOwnerOrExtra(guild, user.id)) return interaction.reply({ content: "❌ Unauthorized interaction.", ephemeral: true });
            const cfg = getGuildConfig(guild.id);
            if (customId === 'tog_antinuke') cfg.antinuke = !cfg.antinuke;
            if (customId === 'tog_automod') cfg.automod = !cfg.automod;
            if (customId === 'tog_autorole') cfg.autorole = !cfg.autorole;
            return interaction.update(buildMainPanel(guild));
        }
    }

    if (interaction.isStringSelectMenu()) {
        const { customId, guild, user, values } = interaction;
        if (customId === 'panel_dropdown_menu') {
            if (!isOwnerOrExtra(guild, user.id)) return interaction.reply({ content: "❌ Unauthorized.", ephemeral: true });
            const choice = values[0];
            const cfg = getGuildConfig(guild.id);

            if (choice === 'menu_view_wl') {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setTitle("👑 Whitelist & Extra Owners Roster").addFields(
                        { name: "Extra Owners", value: cfg.extraOwners.map(id => `<@${id}>`).join(', ') || 'None' },
                        { name: "Whitelisted", value: cfg.whitelisted.map(id => `<@${id}>`).join(', ') || 'None' }
                    )],
                    ephemeral: true
                });
            }

            if (choice === 'menu_setup_verify') {
                const embed = new EmbedBuilder().setTitle("🛡️ Verification Gatekeeper").setColor(0x00ffaa).setDescription("Click the button below to verify your membership and unlock the server channels.");
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_verify_click').setLabel('Verify Account').setStyle(ButtonStyle.Success).setEmoji('✅'));
                await interaction.channel.send({ embeds: [embed], components: [row] });
                return interaction.reply({ content: "✅ Verification button deployed successfully in this channel!", ephemeral: true });
            }

            if (choice === 'menu_set_logs') {
                cfg.logChannelId = interaction.channel.id;
                await interaction.update(buildMainPanel(guild));
                return interaction.followUp({ content: `📜 Central logging channel set to <#${interaction.channel.id}>`, ephemeral: true });
            }

            if (choice === 'menu_lockdown') {
                cfg.lockdown = !cfg.lockdown;
                guild.channels.cache.forEach(c => {
                    if (c.isTextBased()) c.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: !cfg.lockdown }).catch(() => {});
                });
                await interaction.update(buildMainPanel(guild));
                return interaction.followUp({ content: cfg.lockdown ? "🔒 Server locked down!" : "🔓 Server unlocked!", ephemeral: true });
            }
        }
    }
});

// --- ANTINUKE & PERMISSION GUARD CORE ---
client.on('guildMemberAdd', async member => {
    const cfg = getGuildConfig(member.guild.id);
    if (!member.user.bot && cfg.autorole && cfg.autoroleId) {
        member.roles.add(cfg.autoroleId).catch(() => {});
    }

    dispatchLog(member.guild, new EmbedBuilder().setTitle('📥 Member Joined').setDescription(`${member.user.tag} (${member.id})`).setTimestamp());

    if (member.user.bot && cfg.antinuke) {
        try {
            const logs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd });
            const entry = logs.entries.first();
            if (entry && entry.target.id === member.id && !isOwnerOrExtra(member.guild, entry.executor.id)) {
                await member.ban({ reason: "Anti-Nuke: Unauthorized bot addition." });
                const exec = await member.guild.members.fetch(entry.executor.id).catch(() => null);
                if (exec && exec.bannable) {
                    await exec.ban({ reason: "Anti-Nuke: Added unauthorized bot." });
                }
                dispatchLog(member.guild, new EmbedBuilder().setTitle('🚨 ANTINUKE TRIGGERED').setColor(0xff0000).setDescription(`Unauthorized bot **${member.user.tag}** was added by **${entry.executor.tag}**. Both banned instantly.`));
            }
        } catch (e) {}
    }
});

client.on('roleUpdate', async (oldR, newR) => {
    const cfg = getGuildConfig(newR.guild.id);
    if (cfg.antinuke && newR.permissions.has(DANGEROUS_PERMS)) {
        try {
            const logs = await newR.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
            const entry = logs.entries.first();
            if (entry && !isOwnerOrExtra(newR.guild, entry.executor.id)) {
                await newR.setPermissions(0n, "Revoked harmful permissions.");
                dispatchLog(newR.guild, new EmbedBuilder().setTitle('🛡️ Perm Guard Triggered').setColor(0xff0000).setDescription(`Revoked administrative permissions from role **${newR.name}** granted by **${entry.executor.tag}**.`));
            }
        } catch (e) {}
    }
});

client.on('guildMemberUpdate', async (oldM, newM) => {
    if (oldM.nickname !== newM.nickname) {
        dispatchLog(newM.guild, new EmbedBuilder().setTitle('✏️ Nickname Changed').setDescription(`**${newM.user.tag}**\n**Old:** \`${oldM.nickname || 'None'}\`\n**New:** \`${newM.nickname || 'None'}\``));
    }
    const cfg = getGuildConfig(newM.guild.id);
    if (cfg.antinuke && !isWhitelistedUser(newM.guild, newM.id) && newM.permissions.has(DANGEROUS_PERMS)) {
        const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id) && r.permissions.has(DANGEROUS_PERMS));
        if (added.size > 0) {
            await newM.roles.remove(added).catch(() => {});
            dispatchLog(newM.guild, new EmbedBuilder().setTitle('🛡️ Dangerous Role Removed').setColor(0xff0000).setDescription(`Removed high permissions from non-whitelisted user **${newM.user.tag}**.`));
        }
    }
});

// --- A-TO-Z AUDIT LOGGERS ---
client.on('channelCreate', c => dispatchLog(c.guild, new EmbedBuilder().setTitle('📁 Channel Created').setDescription(`**#${c.name}**`)));
client.on('channelDelete', c => dispatchLog(c.guild, new EmbedBuilder().setTitle('🗑️ Channel Deleted').setDescription(`**#${c.name}**`)));
client.on('roleCreate', r => dispatchLog(r.guild, new EmbedBuilder().setTitle('✨ Role Created').setDescription(`**${r.name}**`)));
client.on('roleDelete', r => dispatchLog(r.guild, new EmbedBuilder().setTitle('🗑️ Role Deleted').setDescription(`**${r.name}**`)));
client.on('guildMemberRemove', async m => {
    let desc = `**${m.user.tag}** left the server.`;
    try {
        const logs = await m.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
        const entry = logs.entries.first();
        if (entry && entry.target.id === m.id && (Date.now() - entry.createdTimestamp < 5000)) {
            desc = `👢 **${m.user.tag}** was kicked by **${entry.executor.tag}**.\nReason: ${entry.reason || 'None'}`;
        }
    } catch (e) {}
    dispatchLog(m.guild, new EmbedBuilder().setTitle('📤 Member Left / Kicked').setDescription(desc));
});
client.on('messageDelete', m => dispatchLog(m.guild, new EmbedBuilder().setTitle('🗑️ Message Deleted').addFields(
    { name: 'Author', value: `${m.author?.tag || 'Unknown'}` },
    { name: 'Channel', value: `<#${m.channel.id}>` },
    { name: 'Content', value: m.content || '[Attachment/Embed Only]' }
)));

client.login(process.env.DISCORD_TOKEN);
