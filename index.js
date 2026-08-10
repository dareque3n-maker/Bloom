require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const mongoose = require('mongoose');
const User = require('./models/User');
const Pet = require('./models/Pet');
const ChannelConfig = require('./models/ChannelConfig');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('Connected to MongoDB Database successfully.');
}).catch(err => {
    console.error('MongoDB Connection Error:', err);
});

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

const PREFIXES = ['bloom ', 'BLOOM ', 'Bloom ', 'b '];
const ELEMENTS = [
    "Fire", "Water", "Earth", "Air", "Lightning", "Ice", 
    "Nature", "Darkness", "Light", "Shadow", "Plasma", "Cosmic"
];

const BOT_OWNER_ID = '1474216218792558735';
const activeBattles = new Set();

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const contentLower = message.content.toLowerCase();
    let usedPrefix = PREFIXES.find(p => contentLower.startsWith(p));
    
    if (usedPrefix) {
        const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'set') {
            if (!message.member.permissions.has('Administrator') && message.author.id !== BOT_OWNER_ID) {
                return message.reply(`Only server administrators or the bot owner can set the bot channel.`);
            }

            await ChannelConfig.findOneAndUpdate(
                { guildId: message.guild.id },
                { channelId: message.channel.id },
                { upsert: true, new: true }
            );

            return message.reply(`Bot commands are now locked to this channel!`);
        }
    }

    const channelConfig = await ChannelConfig.findOne({ guildId: message.guild.id });
    if (channelConfig && channelConfig.channelId !== message.channel.id) {
        return;
    }

    if (!usedPrefix) return;

    const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    let dbUser = await User.findOne({ userId: message.author.id });
    if (!dbUser) {
        dbUser = await User.create({ userId: message.author.id });
    }

    // --- XP & LEVEL SYSTEM ---
    if (dbUser.level < 250) {
        dbUser.xpBars += 1;
        let requiredXp = dbUser.level * 500;
        if (dbUser.xpBars >= requiredXp) {
            dbUser.level += 1;
            dbUser.xpBars = 0;
            message.channel.send(`Congratulations ${message.author}, your level has increased to **Level ${dbUser.level}**!`);
        }
        await dbUser.save();
    }

    // 1. Balance Command
    if (['bal', 'cash', 'c', 'balance'].includes(command)) {
        return message.reply(`You currently have **${dbUser.balance}** Bloom Cash.`);
    }

    // 2. Profile Command
    if (command === 'profile') {
        let pet = await Pet.findOne({ userId: message.author.id });
        const embed = new EmbedBuilder()
            .setTitle(`${message.author.username}'s Profile`)
            .setColor('#00ffcc')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Bloom Cash', value: `${dbUser.balance} Cash`, inline: true },
                { name: 'Chat Level', value: `Level ${dbUser.level}`, inline: true },
                { name: 'XP Progress', value: `${dbUser.xpBars} / ${dbUser.level * 500} Bars`, inline: true },
                { name: 'Active Pet', value: pet ? `${pet.name} (Lvl ${pet.petLevel})` : 'No pet created yet! Use `bloom createpet`', inline: false },
                { name: 'Inventory', value: `Food Items: **${dbUser.inventory.food}** | Cards: **${dbUser.inventory.cards.length}**`, inline: false }
            )
            .setFooter({ text: 'Bloom Game Bot Profile System' });

        return message.reply({ embeds: [embed] });
    }

    // 3. Create Pet Command
    if (command === 'createpet') {
        const petName = args[0];
        const photoUrl = args[1];

        if (!petName || !photoUrl) {
            return message.reply(`Please provide a name and photo URL for your pet! Example: \`bloom createpet Dragon https://i.imgur.com/xyz.png\``);
        }

        let pet = await Pet.findOneAndUpdate(
            { userId: message.author.id },
            { name: petName, photoUrl: photoUrl, hunger: 100, petLevel: 1 },
            { upsert: true, new: true }
        );

        return message.reply(`Successfully registered your pet **${pet.name}**! Check its status using \`bloom pet\`.`);
    }

    // 4. Daily Reward
    if (command === 'daily') {
        const now = new Date();
        if (dbUser.lastDaily && now - dbUser.lastDaily < 24 * 60 * 60 * 1000) {
            const remainingHours = Math.ceil((24 * 60 * 60 * 1000 - (now - dbUser.lastDaily)) / (1000 * 60 * 60));
            return message.reply(`You have already claimed your daily reward. Next reward available in **${remainingHours} hours**.`);
        }
        
        dbUser.balance += 500;
        dbUser.inventory.food += 2;
        dbUser.lastDaily = now;
        await dbUser.save();
        return message.reply(`Daily reward claimed successfully! **+500 Bloom Cash** and **+2 Food Items** added to your inventory.`);
    }

    // 5. Pet Profile
    if (command === 'pet') {
        let pet = await Pet.findOne({ userId: message.author.id });
        if (!pet) return message.reply(`You haven't created a pet yet! Use \`bloom createpet <name> <photo_url>\`.`);

        const embed = new EmbedBuilder()
            .setTitle(`${pet.name}'s Profile`)
            .setColor('#0099ff')
            .setThumbnail(pet.photoUrl)
            .addFields(
                { name: 'Level', value: `${pet.petLevel}`, inline: true },
                { name: 'Hunger Status', value: `${pet.hunger}%`, inline: true },
                { name: 'Food in Bag', value: `${dbUser.inventory.food}`, inline: true }
            )
            .setFooter({ text: 'Use bloom feed to keep your pet energetic!' });

        return message.reply({ embeds: [embed] });
    }

    // 6. Feed Pet
    if (command === 'feed') {
        let pet = await Pet.findOne({ userId: message.author.id });
        if (!pet) return message.reply(`You don't have a pet to feed!`);

        if (dbUser.inventory.food <= 0) {
            return message.reply(`You are out of food items! Use \`bloom shop\` to purchase more food.`);
        }
        if (pet.hunger >= 100) {
            return message.reply(`Your pet is already fully fed and energetic!`);
        }

        dbUser.inventory.food -= 1;
        pet.hunger = Math.min(100, pet.hunger + 30);
        await dbUser.save();
        await pet.save();

        return message.reply(`You fed your pet successfully! Current hunger level is **${pet.hunger}%**.`);
    }

    // 7. Shop Command (Updated Pricing: Card = 1m, Food 5x = 10000)
    if (command === 'shop') {
        const shopEmbed = new EmbedBuilder()
            .setTitle('BLOOM GAME SHOP')
            .setColor('#ffd700')
            .setDescription('Welcome to the shop! Use `bloom buy <item>` to purchase items.')
            .addFields(
                { name: '1. Food Pack (5x Food)', value: 'Cost: **10,000 Bloom Cash**\nCommand: `bloom buy food`', inline: false },
                { name: '2. Element Card Roll', value: 'Cost: **1,000,000 Bloom Cash**\nCommand: `bloom buy card`', inline: false },
                { name: 'Available Elements', value: ELEMENTS.join(', '), inline: false }
            );
        return message.reply({ embeds: [shopEmbed] });
    }

    // 8. Buy Command (Updated Pricing)
    if (command === 'buy') {
        const item = args[0]?.toLowerCase();
        if (!item) return message.reply(`Please specify an item to buy! Check \`bloom shop\`.`);

        if (item === 'food') {
            if (dbUser.balance < 10000) return message.reply(`You do not have enough Bloom Cash (Requires 10,000 Cash).`);
            dbUser.balance -= 10000;
            dbUser.inventory.food += 5;
            await dbUser.save();
            return message.reply(`Successfully purchased 5x Food items for 10,000 Cash!`);
        } else if (item === 'card') {
            if (dbUser.balance < 1000000) return message.reply(`You do not have enough Bloom Cash (Requires 1,000,000 Cash).`);
            dbUser.balance -= 1000000;
            const randomElement = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
            dbUser.inventory.cards.push({
                cardId: 'card_' + Date.now(),
                name: `${randomElement} Guardian`,
                element: randomElement,
                level: 1,
                battleStreak: 0,
                unlockedAbilities: 1
            });
            await dbUser.save();
            return message.reply(`Successfully purchased and unlocked a new **${randomElement} Element Card** for 1,000,000 Cash!`);
        }
        return message.reply(`Invalid item specified. Check \`bloom shop\` for available items.`);
    }

    // 9. Coinflip / Flip Game (Updated Logic: max 100,000 bet, auto heads if h/t omitted, support for 'all')
    if (['flip', 'cf'].includes(command)) {
        let choiceArg = args[0]?.toLowerCase();
        let amountArg = args[1]?.toLowerCase();

        let choice = 'heads';
        let amount = 0;

        // Parse arguments handling cases like: b flip 5000, b cf h 5000, b cf 5000, b cf all
        if (['heads', 'tails', 'h', 't'].includes(choiceArg)) {
            choice = ['heads', 'h'].includes(choiceArg) ? 'heads' : 'tails';
            amountArg = args[1]?.toLowerCase();
        } else if (choiceArg === 'all') {
            choice = 'heads';
            amountArg = 'all';
        } else if (!isNaN(parseInt(choiceArg))) {
            choice = 'heads'; // default to heads if omitted
            amountArg = choiceArg;
        }

        if (amountArg === 'all') {
            amount = dbUser.balance;
        } else {
            amount = parseInt(amountArg);
        }

        if (isNaN(amount) || amount <= 0) {
            return message.reply(`Usage: \`bloom cf <heads/tails> <amount>\` or \`bloom flip <amount>\`. Max bet is 100,000.`);
        }

        if (amount > 100000) {
            return message.reply(`Maximum bet limit is **100,000 Bloom Cash**!`);
        }

        if (dbUser.balance < amount) {
            return message.reply(`You do not have sufficient balance for this bet.`);
        }

        let flipMsg = await message.reply(`🪙 Coin is spinning in the air... 💫`);
        
        setTimeout(async () => {
            await flipMsg.edit(`🪙 Flipping... 🔄`);
        }, 1000);

        setTimeout(async () => {
            const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
            const won = choice === outcome;

            if (won) {
                dbUser.balance += amount;
                await dbUser.save();
                await flipMsg.edit(`🪙 Result: **${outcome.toUpperCase()}**! You chose ${choice.toUpperCase()}. 🎉 You won **+${amount}** Bloom Cash! New Balance: **${dbUser.balance}**`);
            } else {
                dbUser.balance -= amount;
                await dbUser.save();
                await flipMsg.edit(`🪙 Result: **${outcome.toUpperCase()}**! You chose ${choice.toUpperCase()}. 😢 You lost **-${amount}** Bloom Cash! New Balance: **${dbUser.balance}**`);
            }
        }, 2000);
        return;
    }

    // 10. Leaderboards (`bloom lb cash` & `bloom lb ranking`)
    if (['lb', 'leaderboard'].includes(command)) {
        const subType = args[0]?.toLowerCase();

        if (['cash', 'c', ''].includes(subType)) {
            const topUsers = await User.find().sort({ balance: -1 }).limit(10);
            const embed = new EmbedBuilder()
                .setTitle(`🏆 Bloom Global Cash Leaderboard`)
                .setColor('#ffd700');

            let desc = '';
            topUsers.forEach((u, index) => {
                desc += `**${index + 1}.** <@${u.userId}> — **${u.balance}** Cash\n`;
            });
            embed.setDescription(desc || 'No users found.');
            return message.reply({ embeds: [embed] });
        } else if (['r', 'ranking', 'pets'].includes(subType)) {
            const topPets = await Pet.find().sort({ petLevel: -1 }).limit(10);
            const embed = new EmbedBuilder()
                .setTitle(`🐾 Bloom Pet Level Ranking Leaderboard`)
                .setColor('#00ffcc');

            let desc = '';
            topPets.forEach((p, index) => {
                desc += `**${index + 1}.** <@${p.userId}>'s Pet (**${p.name}**) — Level **${p.petLevel}**\n`;
            });
            embed.setDescription(desc || 'No pets found.');
            return message.reply({ embeds: [embed] });
        }
    }

    // 11. Owner Panel Command (`/bloom panel` -> triggered via bloom panel or b panel)
    if (command === 'panel') {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.reply(`Access Denied! This command is strictly restricted to the bot owner.`);
        }

        const panelEmbed = new EmbedBuilder()
            .setTitle(`👑 Bloom Bot Owner Management Panel`)
            .setColor('#ff0000')
            .setDescription(`Welcome to the control panel. Click the button below to configure card images or manage settings.`)
            .setFooter({ text: 'Restricted Owner Control Panel' });

        const panelButtonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('owner_modal_card_images')
                .setLabel('🖼️ Set Card Images')
                .setStyle(ButtonStyle.Primary)
        );

        return message.reply({ embeds: [panelEmbed], components: [panelButtonRow] });
    }

    // Legacy Owner Commands
    if (['addcash', 'removecash', 'resetall'].includes(command)) {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.reply(`Access Denied! This command is strictly restricted to the bot owner.`);
        }

        if (command === 'resetall') {
            await User.deleteMany({});
            await Pet.deleteMany({});
            await ChannelConfig.deleteMany({});
            return message.reply(`Database completely wiped and reset successfully by bot owner!`);
        }

        const targetUser = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!targetUser || isNaN(amount)) {
            return message.reply(`Usage: \`bloom addcash @user <amount>\` or \`bloom removecash @user <amount>\``);
        }

        let targetDbUser = await User.findOne({ userId: targetUser.id });
        if (!targetDbUser) targetDbUser = await User.create({ userId: targetUser.id });

        if (command === 'addcash') {
            targetDbUser.balance += amount;
            await targetDbUser.save();
            return message.reply(`Successfully added **${amount}** Bloom Cash to <@${targetUser.id}>.`);
        } else {
            targetDbUser.balance = Math.max(0, targetDbUser.balance - amount);
            await targetDbUser.save();
            return message.reply(`Successfully removed **${amount}** Bloom Cash from <@${targetUser.id}>.`);
        }
    }

    // 12. Live 1v1 Battle Command
    if (command === 'battle') {
        const opponent = message.mentions.users.first();
        if (!opponent) return message.reply(`Please mention an opponent for battle! Example: \`bloom battle @user\``);
        if (opponent.bot) return message.reply(`You cannot battle against bots!`);
        if (opponent.id === message.author.id) return message.reply(`You cannot battle against yourself!`);

        if (activeBattles.has(message.author.id) || activeBattles.has(opponent.id)) {
            return message.reply(`One of the players is already engaged in an active battle!`);
        }

        let p1Pet = await Pet.findOne({ userId: message.author.id });
        let p2Pet = await Pet.findOne({ userId: opponent.id });

        if (!p1Pet || !p2Pet) {
            return message.reply(`Both players must create a pet first using \`bloom createpet <name> <photo_url>\` before battling!`);
        }

        if (p1Pet.hunger < 20) {
            return message.reply(`Your pet (${p1Pet.name}) is too hungry to fight! Use \`bloom feed\` first.`);
        }

        activeBattles.add(message.author.id);
        activeBattles.add(opponent.id);

        let p1Hp = 100;
        let p2Hp = 100;
        let turn = message.author.id;

        const abilities = [
            { name: 'Punch', dmg: 12 },
            { name: 'Flame Burst', dmg: 20 },
            { name: 'Spark Shock', dmg: 22 },
            { name: 'Water Whip', dmg: 18 },
            { name: 'Leaf Blade', dmg: 16 },
            { name: 'Ice Spike', dmg: 25 }
        ];

        const getBattleButtons = (disabled = false) => {
            const row1 = new ActionRowBuilder();
            const row2 = new ActionRowBuilder();

            abilities.slice(0, 3).forEach((ab, index) => {
                row1.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`battle_${index}`)
                        .setLabel(ab.name)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabled)
                );
            });

            abilities.slice(3, 6).forEach((ab, index) => {
                row2.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`battle_${index + 3}`)
                        .setLabel(ab.name)
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(disabled)
                );
            });

            return [row1, row2];
        };

        const getBattleEmbed = (statusText) => {
            return new EmbedBuilder()
                .setTitle(`LIVE PET BATTLE: ${p1Pet.name} VS ${p2Pet.name}`)
                .setColor('#ff0000')
                .addFields(
                    { name: `${message.author.username} (${p1Pet.name})`, value: `HP: **${p1Hp}/100**`, inline: true },
                    { name: `Turn`, value: `<@${turn}>`, inline: true },
                    { name: `${opponent.username} (${p2Pet.name})`, value: `HP: **${p2Hp}/100**`, inline: true },
                    { name: 'Battle Log', value: statusText, inline: false }
                )
                .setFooter({ text: 'Select your ability using the buttons below!' });
        };

        let initialMsg = await message.channel.send({
            content: `<@${message.author.id}> vs <@${opponent.id}>`,
            embeds: [getBattleEmbed(`Battle has started! It is <@${turn}>'s turn.`)],
            components: getBattleButtons(false)
        });

        const collector = initialMsg.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== turn) {
                return i.reply({ content: `It is not your turn yet!`, ephemeral: true });
            }

            const abilityIndex = parseInt(i.customId.split('_')[1]);
            const chosenAbility = abilities[abilityIndex];
            let damage = chosenAbility.dmg + Math.floor(Math.random() * 5);
            let logText = "";

            if (turn === message.author.id) {
                p2Hp = Math.max(0, p2Hp - damage);
                logText = `**${p1Pet.name}** used **${chosenAbility.name}** dealing **${damage} damage**!`;
                turn = opponent.id;
            } else {
                p1Hp = Math.max(0, p1Hp - damage);
                logText = `**${p2Pet
