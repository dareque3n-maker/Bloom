const mongoose = require('mongoose');

const GuildStoreSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    serverName: { type: String, default: 'Community Server' },
    adminRoleId: { type: String, default: '' },
    logsChannelId: { type: String, default: '' },
    consoleChannelId: { type: String, default: '' },
    panelTitle: { type: String, default: '🛒 Server Storefront' },
    panelDescription: { type: String, default: 'Select a category below to explore available packages.' },
    panelBanner: { type: String, default: '' },
    categories: [String], 
    items: [{
        category: String,
        name: String,
        price: Number,
        command: String
    }],
    dmApproved: { type: String, default: 'Your order for **{{item}}** at **{{server}}** has been approved!' },
    dmRejected: { type: String, default: 'Unfortunately, your order for **{{item}}** at **{{server}}** has been declined.' }
});

const OrderTicketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    buyerId: { type: String, required: true },
    buyerIGN: { type: String, required: true },
    itemName: { type: String, required: true },
    itemPrice: { type: Number, required: true },
    itemCategory: { type: String, required: true }
});

module.exports = {
    GuildStore: mongoose.model('GuildStore', GuildStoreSchema),
    OrderTicket: mongoose.model('OrderTicket', OrderTicketSchema)
};
