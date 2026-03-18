const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Purchase = require('./models/Purchase');
const { load: loadStorage, save: saveStorage } = require('./storage');
const { sendSMS, normalizePhone } = require('./sms');
const { sendEmail } = require('./email');
const { lookupDummyBarcode } = require('./dummyBarcodes');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'pantry_secret_2026';
const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/pantrypal';

let useMongoDB = true;
let USERS_DB = [];
let INVENTORY_DB = [];
let PURCHASES_DB = [];

// --- MongoDB Connection & Server Start ---
const startServer = async () => {
    try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
        console.log('✅ MongoDB Connected: pantrypal');
    } catch (err) {
        useMongoDB = false;
        const data = loadStorage();
        USERS_DB = data.users || [];
        INVENTORY_DB = data.inventory || [];
        PURCHASES_DB = data.purchases || [];
        console.log('📁 Using local file storage (data persists!)');
    }

    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} — ready for PantryPal+`);
    });
};
startServer();

const calculateDiscount = (item) => {
    const today = new Date();
    const expiry = new Date(item.expiryDate);
    const monthsLeft = (expiry - today) / (1000 * 60 * 60 * 24 * 30.44);
    const qty = item.quantity || 0;

    let qtyDisc = 0;
    if (qty > 300) qtyDisc = 20;
    else if (qty > 150) qtyDisc = 12;
    else if (qty > 100) qtyDisc = 8;
    else if (qty > 50) qtyDisc = 5;

    let expDisc = 0;
    let status = "Fresh";
    let color = "emerald";

    if (monthsLeft <= 0) { status = "EXPIRED"; color = "red"; expDisc = 0; }
    else if (monthsLeft < 3) { expDisc = 40; status = "URGENT SALE"; color = "red"; }
    else if (monthsLeft < 6) { expDisc = 20; status = "USE SOON"; color = "yellow"; }
    else if (monthsLeft < 12) { expDisc = 10; status = "Near Expiry"; color = "yellow"; }
    else { expDisc = 2; color = "green"; }

    let catBonus = 0;
    if (['Dairy', 'Bakery'].includes(item.category)) catBonus = 10;
    else if (item.category === 'Medicines') catBonus = 15;
    else if (item.category === 'Snacks') catBonus = 5;

    let baseDisc = (monthsLeft < 3) ? expDisc : Math.max(qtyDisc, expDisc);
    let finalDisc = baseDisc + catBonus;

    if (finalDisc > 50) finalDisc = 50;
    if (monthsLeft <= 0) finalDisc = 0;

    let expiryStatus = 'fresh';
    if (monthsLeft <= 0 || monthsLeft < 3) expiryStatus = 'urgent';
    else if (monthsLeft < 12) expiryStatus = 'near';
    return {
        finalDiscount: Math.round(finalDisc),
        statusLabel: status,
        themeColor: color,
        expiryStatus,
        daysLeft: Math.ceil(monthsLeft * 30.44),
        isOverstocked: qty > 150
    };
};

// --- Auth Middleware ---
function auth(req, res, next) {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Denied" });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        return res.status(400).json({ message: "Invalid Token" });
    }
}

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, phone, password, role, email } = req.body;
        if (!name || !phone || !password || !role) {
            return res.status(400).json({ message: "All fields required" });
        }
        const phoneNorm = normalizePhone(phone) || phone;
        if (!phoneNorm || phoneNorm.length < 10) return res.status(400).json({ message: "Valid 10-digit phone required" });
        console.log(`📝 Registering: ${name} (${phoneNorm})`);

        const emailClean = (email || '').trim() || undefined;

        if (useMongoDB) {
            const all = await User.find();
            if (all.some(u => normalizePhone(u.phone) === phoneNorm)) return res.status(400).json({ message: "User already exists" });
            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({ name, phone: phoneNorm, email: emailClean, password: hashedPassword, role });
        } else {
            if (USERS_DB.some(u => normalizePhone(u.phone) === phoneNorm)) return res.status(400).json({ message: "User already exists" });
            const hashedPassword = await bcrypt.hash(password, 10);
            USERS_DB.push({ id: Date.now().toString(), name, phone: phoneNorm, email: emailClean, password: hashedPassword, role });
            saveStorage(USERS_DB, INVENTORY_DB, PURCHASES_DB);
        }
        console.log("✅ User Created");
        res.status(201).json({ message: "User Created" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const phoneNorm = normalizePhone(phone) || phone;
        if (!phoneNorm || phoneNorm.length < 10) return res.status(400).json({ message: "Valid 10-digit phone required" });
        const user = useMongoDB
            ? (await User.find()).find(u => normalizePhone(u.phone) === phoneNorm)
            : USERS_DB.find(u => normalizePhone(u.phone) === phoneNorm);
        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid Password" });

        const id = useMongoDB ? user._id.toString() : user.id;
        const token = jwt.sign({ id, role: user.role }, JWT_SECRET);
        console.log(`🔑 Logged in: ${user.name}`);
        // Send login SMS to the phone number used to login (more reliable than stored formatting)
        const loginPhone = normalizePhone(phoneNorm) || normalizePhone(user.phone);
        if (loginPhone && loginPhone.length >= 10) {
            sendSMS(loginPhone, `PantryPal+: Welcome back ${user.name}! Login successful.`).catch(() => { });
        }
        // Optional email notification
        if (user.email) {
            sendEmail(
                user.email,
                'PantryPal+ Login Alert',
                `Hi ${user.name},\n\nYou just logged in to PantryPal+ as ${user.role} using phone ${user.phone}.\n\nIf this was not you, please change your password.\n\nThank you for using PantryPal+ to manage your products!`
            ).catch(() => { });
        }
        res.json({ token, user: { name: user.name, phone: user.phone, role: user.role, email: user.email } });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server Error" });
    }
});

// --- Inventory Routes ---
app.get('/api/inventory', auth, async (req, res) => {
    try {
        const items = useMongoDB
            ? await Inventory.find({ ownerId: req.user.id }).lean()
            : INVENTORY_DB.filter(i => i.ownerId === req.user.id);
        const enriched = items.map(item => {
            const id = item._id ? item._id.toString() : item._id;
            const rules = calculateDiscount(item);
            return { ...item, _id: id || item._id, ...rules };
        });
        res.json(enriched);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error" });
    }
});

app.post('/api/inventory', auth, async (req, res) => {
    try {
        const { name, barcode, expiryDate, quantity, quantityUnit, price, category } = req.body;
        const itemData = {
            name: name || 'Unknown',
            barcode: barcode || '',
            expiryDate: expiryDate || new Date(),
            quantity: Number(quantity) || 0,
            quantityUnit: quantityUnit || '',
            price: Number(price) || 0,
            category: category || 'General',
            ownerId: req.user.id
        };
        let newItem;
        if (useMongoDB) {
            newItem = await Inventory.create(itemData);
            const itemObj = newItem.toObject();
            const rules = calculateDiscount(itemObj);
            console.log(`📦 Added item: ${newItem.name}`);
            return res.status(201).json({ ...itemObj, _id: itemObj._id.toString(), ...rules });
        }
        newItem = { ...itemData, _id: Date.now().toString(), createdAt: new Date() };
        INVENTORY_DB.push(newItem);
        saveStorage(USERS_DB, INVENTORY_DB, PURCHASES_DB);
        const rules = calculateDiscount(newItem);
        console.log(`📦 Added item: ${newItem.name}`);
        res.status(201).json({ ...newItem, ...rules });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error" });
    }
});

// Delete inventory item (retailer or customer owns their own items)
app.delete('/api/inventory/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        if (useMongoDB) {
            const item = await Inventory.findOne({ _id: id, ownerId: req.user.id });
            if (!item) return res.status(404).json({ message: "Not found" });
            await item.deleteOne();
            return res.json({ message: "Deleted" });
        }
        const idx = INVENTORY_DB.findIndex(i => (i._id === id || i._id?.toString?.() === id) && i.ownerId === req.user.id);
        if (idx === -1) return res.status(404).json({ message: "Not found" });
        INVENTORY_DB.splice(idx, 1);
        saveStorage(USERS_DB, INVENTORY_DB, PURCHASES_DB);
        res.json({ message: "Deleted" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error" });
    }
});

// --- Barcode Lookup (for scanner - own inventory) ---
app.get('/api/inventory/by-barcode/:barcode', auth, async (req, res) => {
    try {
        const { barcode } = req.params;
        if (useMongoDB) {
            const item = await Inventory.findOne({ ownerId: req.user.id, barcode }).lean();
            if (!item) return res.status(404).json({ message: "Product not found" });
            const rules = calculateDiscount(item);
            res.json({ ...item, _id: item._id.toString(), ...rules });
        } else {
            const item = INVENTORY_DB.find(i => i.ownerId === req.user.id && String(i.barcode) === String(barcode));
            if (!item) return res.status(404).json({ message: "Product not found" });
            const rules = calculateDiscount(item);
            res.json({ ...item, ...rules });
        }
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

// --- Global Product Lookup by Barcode (OpenFoodFacts) ---
app.get('/api/barcode/lookup/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        if (!barcode) return res.status(400).json({ message: "Barcode required" });

        // 1) Local dummy products (for offline/demo use)
        const local = lookupDummyBarcode(barcode);
        if (local) {
            return res.json({
                name: local.name,
                quantityLabel: local.qtyUnit,
                qtyUnit: local.qtyUnit,
                brand: '',
                category: local.category || 'General',
                barcode: local.barcode,
                price: local.price,
            });
        }

        // 2) Fallback to OpenFoodFacts API
        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
        const resp = await fetch(url).catch(() => null);

        if (resp && resp.ok) {
            const data = await resp.json();
            if (data && data.status === 1 && data.product) {
                const p = data.product;
                return res.json({
                    name: p.product_name || p.generic_name || '',
                    quantityLabel: p.quantity || '',
                    qtyUnit: p.quantity || '',
                    brand: p.brands || '',
                    category: (Array.isArray(p.categories_tags) && p.categories_tags[0] ? String(p.categories_tags[0]).replace(/^en:/, '') : '') || 'General',
                    barcode: data.code,
                });
            }
        }

        // 3) Secondary Fallback (UPCItemDB trial endpoint)
        console.log(`OpenFoodFacts failed for ${barcode}, falling back to UPCItemDB...`);
        const fallbackUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;
        const fallbackResp = await fetch(fallbackUrl).catch(() => null);

        if (fallbackResp && fallbackResp.ok) {
            const fallbackData = await fallbackResp.json();
            if (fallbackData.items && fallbackData.items.length > 0) {
                const p = fallbackData.items[0];
                return res.json({
                    name: p.title || p.description || '',
                    quantityLabel: p.size || p.weight || '',
                    qtyUnit: p.size || p.weight || '',
                    brand: p.brand || '',
                    category: p.category ? String(p.category).split('>').pop().trim() : 'General',
                    barcode: p.ean || p.upc || barcode,
                });
            }
        }

        return res.status(404).json({ message: "Product not found across databases." });
    } catch (e) {
        console.error('Barcode lookup error:', e.message);
        res.status(500).json({ message: "Lookup error" });
    }
});

// --- Sales / Purchases ---
function genPasscode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

app.post('/api/sales', auth, async (req, res) => {
    try {
        const { items, customerPhone } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Items required" });
        }
        const phone = normalizePhone(customerPhone);
        if (!phone || phone.length < 10) {
            return res.status(400).json({ message: "Valid 10-digit customer phone required" });
        }
        const totalAmount = items.reduce((s, i) => s + (i.total || 0), 0);
        let passcode = genPasscode();
        while (true) {
            const exists = useMongoDB ? await Purchase.findOne({ passcode }) : PURCHASES_DB.find(p => p.passcode === passcode);
            if (!exists) break;
            passcode = genPasscode();
        }
        const purchaseData = { passcode, items, totalAmount, retailerId: req.user.id, customerPhone: phone };
        if (useMongoDB) {
            const p = await Purchase.create(purchaseData);
            res.status(201).json({ ...purchaseData, _id: p._id.toString(), createdAt: p.createdAt });
        } else {
            const p = { ...purchaseData, _id: Date.now().toString(), createdAt: new Date() };
            PURCHASES_DB.push(p);
            saveStorage(USERS_DB, INVENTORY_DB, PURCHASES_DB);
            res.status(201).json(p);
        }
        const itemNames = items.map(i => i.name).slice(0, 5).join(', ');
        const msg = `PantryPal+: You purchased ${itemNames}${items.length > 5 ? '...' : ''}. Total Rs.${totalAmount.toFixed(0)}. Passcode: ${passcode}. Login with this phone number and enter passcode to see your items.`;
        sendSMS(phone, msg).catch(() => { });

        // Optional email to customer if we find a user with this phone
        try {
            let customerUser = null;
            if (useMongoDB) {
                const allUsers = await User.find();
                customerUser = allUsers.find(u => normalizePhone(u.phone) === phone);
            } else {
                customerUser = USERS_DB.find(u => normalizePhone(u.phone) === phone);
            }
            if (customerUser && customerUser.email) {
                const lines = items.slice(0, 10).map((it, i) => `${i + 1}. ${it.name} x${it.units || 1} — Rs.${(it.total || 0).toFixed(2)}`);
                const more = items.length > 10 ? `\n... and ${items.length - 10} more item(s)` : '';
                const body = `Hi ${customerUser.name},\n\nThank you for shopping with PantryPal+ retailer.\n\nItems purchased:\n${lines.join('\n')}${more}\n\nTotal: Rs.${totalAmount.toFixed(2)}\nPasscode: ${passcode}\n\nWelcome to PantryPal+. Login with your phone number in the PantryPal+ app and paste this passcode to see and manage your products.\n\nThank you!`;

                console.log(`Sending purchase email to ${customerUser.email}`);
                await sendEmail(customerUser.email, 'PantryPal+ Purchase Confirmation', body).catch(err => console.error("Email send failed (Customer):", err));
            }

            // Also send a copy to the Retailer so they know the sale went through
            let retailerUser = null;
            if (useMongoDB) {
                retailerUser = await User.findById(req.user.id);
            } else {
                retailerUser = USERS_DB.find(u => u.id === req.user.id);
            }

            if (retailerUser && retailerUser.email) {
                const rBody = `Hi ${retailerUser.name},\n\nYou successfully recorded a sale of Rs.${totalAmount.toFixed(2)} to customer phone ${phone}.\nPasscode generated: ${passcode}\n\nThanks for using PantryPal+!`;
                console.log(`Sending purchase email to retailer ${retailerUser.email}`);
                await sendEmail(retailerUser.email, 'PantryPal+ Sale Recorded', rBody).catch(err => console.error("Email send failed (Retailer):", err));
            }
        } catch (emailErr) {
            console.error("Non-fatal email error during sale:", emailErr);
        }
        console.log(`🧾 Sale completed. Passcode: ${passcode}`);
    } catch (e) { console.error(e); res.status(500).json({ message: "Error" }); }
});

app.get('/api/sales', auth, async (req, res) => {
    try {
        const list = useMongoDB
            ? await Purchase.find({ retailerId: req.user.id }).sort({ createdAt: -1 }).lean()
            : PURCHASES_DB.filter(p => p.retailerId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(list.map(p => ({ ...p, _id: p._id?.toString?.() || p._id })));
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

app.get('/api/sales/stats', auth, async (req, res) => {
    try {
        const list = useMongoDB
            ? await Purchase.find({ retailerId: req.user.id }).lean()
            : PURCHASES_DB.filter(p => p.retailerId === req.user.id);
        const today = new Date().toDateString();
        const todayList = list.filter(p => new Date(p.createdAt).toDateString() === today);
        const todayTotal = todayList.reduce((s, p) => s + (p.totalAmount || 0), 0);
        res.json({ todayTotal, todayCount: todayList.length });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

app.get('/api/sales/:id', auth, async (req, res) => {
    try {
        const id = req.params.id;
        const p = useMongoDB
            ? await Purchase.findOne({ _id: id, retailerId: req.user.id }).lean()
            : PURCHASES_DB.find(x => (x._id === id || x._id?.toString?.() === id) && x.retailerId === req.user.id);
        if (!p) return res.status(404).json({ message: "Not found" });
        res.json({ ...p, _id: p._id?.toString?.() || p._id });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});

// --- Customer: Claim purchase by passcode (must match customer phone) ---
app.post('/api/purchases/claim', auth, async (req, res) => {
    try {
        const { passcode } = req.body;
        if (!passcode || String(passcode).length !== 6) {
            return res.status(400).json({ message: "Valid 6-digit passcode required" });
        }
        const p = useMongoDB
            ? await Purchase.findOne({ passcode: String(passcode) })
            : PURCHASES_DB.find(x => String(x.passcode) === String(passcode));
        if (!p) return res.status(404).json({ message: "Invalid passcode" });
        if (p.claimedBy) return res.status(400).json({ message: "Passcode already used" });
        if (p.customerPhone) {
            const user = useMongoDB ? await User.findById(req.user.id) : USERS_DB.find(u => u.id === req.user.id);
            const userPhone = normalizePhone(user?.phone);
            const custPhone = normalizePhone(p.customerPhone);
            if (userPhone && custPhone && userPhone !== custPhone) {
                return res.status(403).json({ message: "This passcode was issued for a different customer. Login with the phone number given at purchase." });
            }
        }
        const customerId = req.user.id;
        for (const it of p.items) {
            const invData = {
                name: it.name,
                barcode: it.barcode || '',
                expiryDate: it.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                quantity: it.units,
                quantityUnit: it.quantityUnit || '',
                price: it.price,
                category: it.category || 'General',
                ownerId: customerId
            };
            if (useMongoDB) await Inventory.create(invData);
            else { INVENTORY_DB.push({ ...invData, _id: Date.now() + Math.random(), createdAt: new Date() }); }
        }
        if (useMongoDB) { p.claimedBy = customerId; await p.save(); }
        else { p.claimedBy = customerId; saveStorage(USERS_DB, INVENTORY_DB, PURCHASES_DB); }

        // Email notification to customer on claim (if email exists)
        const claimingUser = useMongoDB ? await User.findById(customerId) : USERS_DB.find(u => u.id === customerId);
        if (claimingUser?.email) {
            const items = Array.isArray(p.items) ? p.items : [];
            const lines = items.slice(0, 10).map((it, i) => `${i + 1}. ${it.name} x${it.units || 1}`);
            const more = items.length > 10 ? `\n... and ${items.length - 10} more item(s)` : '';
            const body = `Hi ${claimingUser.name},\n\nYour purchase has been claimed in PantryPal+.\n\nItems added to your pantry:\n${lines.join('\n')}${more}\n\nManage your products, watch expiry, and get recipe ideas inside the PantryPal+ app.\n\nThank you!`;
            sendEmail(claimingUser.email, 'PantryPal+ Items Added to Your Pantry', body).catch(() => { });
        }

        res.json({ message: "Purchase claimed!", items: p.items });
    } catch (e) { console.error(e); res.status(500).json({ message: "Error" }); }
});

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

