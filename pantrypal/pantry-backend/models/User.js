const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String }, // optional, for notifications
    password: { type: String, required: true },
    role: { type: String, enum: ['RETAILER', 'CUSTOMER'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);