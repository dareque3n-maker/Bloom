const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

client.commands = new Collection();
const commands = [];

// Commands folder se saari commands read karna
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command.data);
            commands.push(command.data.toJSON());
        }
    }
}

// Bot ready hone par commands Discord par deploy karna
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        // Global commands register karne ke liye (Thoda time leti hain sync hone mein)
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// Login Bot
client.login(process.env.DISCORD_TOKEN);
