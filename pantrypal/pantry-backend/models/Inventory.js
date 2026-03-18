const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
    barcode: { type: String, default: '' },
    name: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true },
    quantityUnit: { type: String, default: '' },
    price: { type: Number, required: true },
    category: { type: String, default: 'General' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Inventory', InventorySchema);
