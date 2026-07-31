const fs = require('fs');
const path = require('path');

async function loadHandlers(client) {
    const handlersPath = path.join(__dirname);
    const handlerFiles = fs.readdirSync(handlersPath).filter(file => file.endsWith('.js') && file !== 'index.js');

    for (const file of handlerFiles) {
        const handler = require(path.join(handlersPath, file));
        await handler(client);
    }
}

module.exports = { loadHandlers };
