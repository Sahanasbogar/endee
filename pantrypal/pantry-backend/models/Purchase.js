const mongoose = require('mongoose');

const PurchaseItemSchema = new mongoose.Schema({
    productId: String,
    name: { type: String, required: true },
    barcode: String,
    category: { type: String, default: 'General' },
    quantityUnit: { type: String, default: '' },
    units: { type: Number, required: true },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
    expiryDate: Date
});

const PurchaseSchema = new mongoose.Schema({
    passcode: { type: String, required: true, unique: true },
    items: [PurchaseItemSchema],
    totalAmount: { type: Number, required: true },
    retailerId: { type: String, required: true },
    customerPhone: { type: String, required: true },
    claimedBy: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Purchase', PurchaseSchema);
