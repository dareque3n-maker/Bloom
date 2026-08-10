const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    name: { type: String, default: "Sparky" },
    photoUrl: { type: String, default: "https://via.placeholder.com/150" },
    hunger: { type: Number, default: 100 }, // Range: 0 to 100
    petLevel: { type: Number, default: 1 }
});

module.exports = mongoose.model('Pet', petSchema);
