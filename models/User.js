const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 1000 },
    xpBars: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    lastDaily: { type: Date, default: null },
    inventory: {
        cards: [{
            cardId: String,
            name: String,
            element: String,
            level: { type: Number, default: 1 },
            battleStreak: { type: Number, default: 0 },
            unlockedAbilities: { type: Number, default: 1 }
        }],
        food: { type: Number, default: 5 }
    }
});

module.exports = mongoose.model('User', userSchema);
