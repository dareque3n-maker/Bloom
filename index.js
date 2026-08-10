require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
const User = require('./models/User');
const Pet = require('./models/Pet');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('Connected to MongoDB Database successfully.');
}).catch(err => {
    console.error('MongoDB Connection Error:', err);
});

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

const PREFIXES = ['spark ', 's '];
const ELEMENTS = [
    "Fire", "Water", "Earth", "Air", "Lightning", "Ice", 
    "Nature", "Darkness", "Light", "Shadow", "Plasma", "Cosmic"
];

// Active battle tracking set
const activeBattles = new Set();

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // --- XP & LEVEL SYSTEM (Chat Based) ---
    let dbUser = await User.findOne({ userId: message.author.id });
    if (!dbUser) {
        dbUser = await User.create({ userId: message.author.id });
    }

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

    // --- COMMAND PARSING ---
    const contentLower = message.content.toLowerCase();
    let usedPrefix = PREFIXES.find(p => contentLower.startsWith(p));
    if (!usedPrefix) return;

    const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. Balance Command
    if (['bal', 'cash', 'c', 'balance'].includes(command)) {
        return message.reply(`You currently have **${dbUser.balance}** Spark Cash.`);
    }

    // 2. Daily Reward Command
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
        return message.reply(`Daily reward claimed successfully! **+500 Spark Cash** and **+2 Food Items** added to your inventory.`);
    }

    // 3. Pet Profile Command
    if (command === 'pet') {
        let pet = await Pet.findOne({ userId: message.author.id });
        if (!pet) pet = await Pet.create({ userId: message.author.id });

        const embed = new EmbedBuilder()
            .setTitle(`${pet.name}'s Profile`)
            .setColor('#0099ff')
            .setThumbnail(pet.photoUrl)
            .addFields(
                { name: 'Level', value: `${pet.petLevel}`, inline: true },
                { name: 'Hunger Status', value: `${pet.hunger}%`, inline: true },
                { name: 'Food in Bag', value: `${dbUser.inventory.food}`, inline: true }
            )
            .setFooter({ text: 'Use spark feed to keep your pet energetic!' });

        return message.reply({ embeds: [embed] });
    }

    // 4. Feed Pet Command
    if (command === 'feed') {
        let pet = await Pet.findOne({ userId: message.author.id });
        if (!pet) pet = await Pet.create({ userId: message.author.id });

        if (dbUser.inventory.food <= 0) {
            return message.reply(`You are out of food items! Use \`spark shop\` to purchase more food.`);
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

    // 5. Shop Command
    if (command === 'shop') {
        return message.reply(
            `**SPARK GAME SHOP**\n\n` +
            `**1. Food Pack (5x Food)** - Cost: 200 Cash (\`spark buy food\`)\n` +
            `**2. Element Card Roll** - Cost: 500 Cash (\`spark roll\`)\n\n` +
            `*Available Elements:* ${ELEMENTS.join(', ')}`
        );
    }

    // 6. Buy Command
    if (command === 'buy') {
        const item = args[0]?.toLowerCase();
        if (item === 'food') {
            if (dbUser.balance < 200) return message.reply(`You do not have enough Spark Cash (Requires 200 Cash).`);
            dbUser.balance -= 200;
            dbUser.inventory.food += 5;
            await dbUser.save();
            return message.reply(`Successfully purchased 5x Food items!`);
        }
        return message.reply(`Invalid item specified. Check \`spark shop\` for available items.`);
    }

    // 7. Coinflip Game Command
    if (['flip', 'cf'].includes(command)) {
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return message.reply(`Please provide a valid betting amount. Example: \`spark flip 100\``);
        if (dbUser.balance < amount) return message.reply(`You do not have sufficient balance for this bet.`);

        const win = Math.random() < 0.5;
        if (win) {
            dbUser.balance += amount;
            await dbUser.save();
            return message.reply(`Victory! You won **+${amount}** Spark Cash. New Balance: **${dbUser.balance}**`);
        } else {
            dbUser.balance -= amount;
            await dbUser.save();
            return message.reply(`Defeat! You lost **-${amount}** Spark Cash. New Balance: **${dbUser.balance}**`);
        }
    }

    // 8. Live 1v1 Battle Command with Interactive Buttons
    if (command === 'battle') {
        const opponent = message.mentions.users.first();
        if (!opponent) return message.reply(`Please mention an opponent for battle! Example: \`spark battle @user\``);
        if (opponent.bot) return message.reply(`You cannot battle against bots!`);
        if (opponent.id === message.author.id) return message.reply(`You cannot battle against yourself!`);

        if (activeBattles.has(message.author.id) || activeBattles.has(opponent.id)) {
            return message.reply(`One of the players is already engaged in an active battle!`);
        }

        let p1Pet = await Pet.findOne({ userId: message.author.id });
        let p2Pet = await Pet.findOne({ userId: opponent.id });

        if (!p1Pet) p1Pet = await Pet.create({ userId: message.author.id });
        if (!p2Pet) p2Pet = await Pet.create({ userId: opponent.id });

        if (p1Pet.hunger < 20) {
            return message.reply(`Your pet (${p1Pet.name}) is too hungry to fight! Use \`spark feed\` first.`);
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
                logText = `**${p2Pet.name}** used **${chosenAbility.name}** dealing **${damage} damage**!`;
                turn = message.author.id;
            }

            if (p1Hp <= 0 || p2Hp <= 0) {
                collector.stop('ended');
                const winner = p1Hp > 0 ? message.author : opponent;
                const winningPet = p1Hp > 0 ? p1Pet : p2Pet;

                p1Pet.hunger = Math.max(0, p1Pet.hunger - 15);
                p2Pet.hunger = Math.max(0, p2Pet.hunger - 15);
                await p1Pet.save();
                await p2Pet.save();

                let winnerUser = await User.findOne({ userId: winner.id });
                if (winnerUser && winnerUser.inventory.cards.length > 0) {
                    winnerUser.inventory.cards[0].battleStreak += 1;
                    await winnerUser.save();
                }

                const winEmbed = new EmbedBuilder()
                    .setTitle(`BATTLE FINISHED - WINNER`)
                    .setColor('#00ff00')
                    .addFields(
                        { name: 'Winner', value: `<@${winner.id}> (${winningPet.name})`, inline: false },
                        { name: 'Final Stats', value: `${message.author.username} HP: **${p1Hp}** | ${opponent.username} HP: **${p2Hp}**`, inline: false },
                        { name: 'Hunger Status', value: `Both pets lost **15% hunger** due to the battle fatigue. Remember to feed them!`, inline: false }
                    );

                return i.update({ embeds: [winEmbed], components: [] });
            }

            await i.update({
                embeds: [getBattleEmbed(logText)],
                components: getBattleButtons(false)
            });
        });

        collector.on('end', (collected, reason) => {
            activeBattles.delete(message.author.id);
            activeBattles.delete(opponent.id);
            if (reason === 'time') {
                initialMsg.edit({ content: `Battle timed out due to player inactivity.`, components: [] }).catch(() => {});
            }
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
