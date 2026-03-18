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
const aiRoutes = require('./ai-routes');
const { initRecipeAI, searchRecipes } = require('./recipeAi');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/ai', aiRoutes);

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

    app.listen(PORT, async () => {
        console.log(`🚀 Server running on port ${PORT} — ready for PantryPal+`);
        
        // Initialize Endee Recipe AI in the background
        console.log(`🧠 Initializing Endee Recipe AI features...`);
        // We do not wait for this to finish to avoid blocking the server startup
        initRecipeAI().catch(err => console.error("Failed to initialize AI:", err));
    });
};
startServer();

// --- Smart Discount Calculation ---
const calculateDiscount = (item) => {
    const today = new Date();
    const expiryDate = new Date(item.expiryDate);
    const mfdDate = item.mfdDate ? new Date(item.mfdDate) : new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)); // Default MFD to 30 days ago if not provided

    // Calculate shelf life and days left
    const shelfLife = Math.ceil((expiryDate - mfdDate) / (1000 * 60 * 60 * 24)); // days
    const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)); // days

    // Calculate expiry risk
    let expiryRisk = 1;
    if (shelfLife > 0) {
        expiryRisk = daysLeft / shelfLife;
    }

    // Determine expiry risk category
    let riskCategory = 'safe';
    if (expiryRisk < 0.2) riskCategory = 'critical';
    else if (expiryRisk < 0.4) riskCategory = 'risky';
    else if (expiryRisk < 0.7) riskCategory = 'moderate';

    // Calculate overstock risk
    let overstockRisk = 'normal';
    if (item.quantity > 100) overstockRisk = 'high';
    else if (item.quantity > 50) overstockRisk = 'moderate';

    // Smart Discount Rules
    let discount = 0;
    let expiryStatus = 'fresh';

    // CRITICAL (High Expiry Risk + High Stock)
    if (daysLeft <= 7 && item.quantity > 50) {
        discount = 40;
        expiryStatus = 'urgent';
    }
    // RISKY (Near Expiry)
    else if (daysLeft <= 15) {
        discount = 20;
        expiryStatus = 'near';
    }
    // MODERATE (Medium Expiry)
    else if (daysLeft <= 30) {
        discount = 10;
        expiryStatus = 'near';
    }
    // SAFE - No discount
    else {
        discount = 0;
        expiryStatus = 'fresh';
    }

    // Cap discount at 50%
    if (discount > 50) discount = 50;

    // If already expired, no discount
    if (daysLeft < 0) {
        discount = 0;
        expiryStatus = 'expired';
    }

    return {
        finalDiscount: discount,
        statusLabel: `${discount}% OFF`,
        themeColor: discount >= 30 ? 'red' : discount >= 20 ? 'amber' : discount >= 10 ? 'yellow' : 'green',
        expiryStatus,
        daysLeft,
        expiryRisk,
        riskCategory,
        overstockRisk,
        shelfLife,
        isOverstocked: item.quantity > 100
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

            // Send welcome email
            if (emailClean) {
                sendEmail(
                    emailClean,
                    'Welcome to PantryPal+',
                    `Hi ${name},\n\nWelcome to PantryPal+! Your account has been successfully created.\n\nLogin Details:\nPhone: ${phoneNorm}\nRole: ${role}\n\nYou can now start managing your inventory efficiently with PantryPal+.\n\nThank you for joining us!`
                ).catch(() => { });
            }
        } else {
            if (USERS_DB.some(u => normalizePhone(u.phone) === phoneNorm)) return res.status(400).json({ message: "User already exists" });
            const hashedPassword = await bcrypt.hash(password, 10);
            USERS_DB.push({ id: Date.now().toString(), name, phone: phoneNorm, email: emailClean, password: hashedPassword, role });
            saveStorage(USERS_DB, INVENTORY_DB, PURCHASES_DB);

            // Send welcome email
            if (emailClean) {
                sendEmail(
                    emailClean,
                    'Welcome to PantryPal+',
                    `Hi ${name},\n\nWelcome to PantryPal+! Your account has been successfully created.\n\nLogin Details:\nPhone: ${phoneNorm}\nRole: ${role}\n\nYou can now start managing your inventory efficiently with PantryPal+.\n\nThank you for joining us!`
                ).catch(() => { });
            }
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

app.post('/api/auth/change-password', auth, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: "Invalid password requirements" });
        }

        const userId = req.user.id;
        let user;

        if (useMongoDB) {
            user = await User.findById(userId);
        } else {
            user = USERS_DB.find(u => u.id === userId);
        }

        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });

        const hashedNew = await bcrypt.hash(newPassword, 10);

        if (useMongoDB) {
            user.password = hashedNew;
            await user.save();
        } else {
            user.password = hashedNew;
            saveStorage(USERS_DB, INVENTORY_DB, PURCHASES_DB);
        }

        if (user.email) {
            sendEmail(
                user.email,
                'PantryPal+ Security Alert',
                `Hi ${user.name},\n\nYour PantryPal+ password was successfully changed.\n\nIf you did not perform this action, please contact support immediately.`
            ).catch(() => { });
        }

        res.json({ message: "Password updated successfully" });

    } catch (err) {
        console.error("Password change error:", err);
        res.status(500).json({ message: "Server error updating password" });
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

            // Email notification
            const u = await User.findById(req.user.id);
            if (u && u.email) {
                sendEmail(u.email, 'PantryPal+: New Item Added', `Hi ${u.name},\n\nYou successfully added ${newItem.quantity}x ${newItem.name} to your PantryPal+ inventory.\n\nThank you for using PantryPal+!`).catch(() => { });
            }

            return res.status(201).json({ ...itemObj, _id: itemObj._id.toString(), ...rules });
        }
        newItem = { ...itemData, _id: Date.now().toString(), createdAt: new Date() };
        INVENTORY_DB.push(newItem);
        saveStorage(USERS_DB, INVENTORY_DB, PURCHASES_DB);
        const rules = calculateDiscount(newItem);
        console.log(`📦 Added item: ${newItem.name}`);

        // Email notification (local)
        const uLocal = USERS_DB.find(u => u.id === req.user.id);
        if (uLocal && uLocal.email) {
            sendEmail(uLocal.email, 'PantryPal+: New Item Added', `Hi ${uLocal.name},\n\nYou successfully added ${newItem.quantity}x ${newItem.name} to your PantryPal+ inventory.\n\nThank you for using PantryPal+!`).catch(() => { });
        }

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

// --- Global Product Lookup by Barcode (Google Lens Style) ---
app.get('/api/barcode/lookup/:barcode', async (req, res) => {
    try {
        const { barcode } = req.params;
        if (!barcode) return res.status(400).json({ message: "Barcode required" });

        console.log(`🔍 Looking up barcode: ${barcode}`);

        // Priority 1: Check dummy data first (fastest response)
        const local = lookupDummyBarcode(barcode);
        if (local) {
            console.log(`✅ Found in dummy data: ${local.name}`);
            return res.json({
                name: local.name,
                fullName: local.name,
                quantityLabel: local.qtyUnit,
                qtyUnit: local.qtyUnit,
                qty: local.qty,
                brand: local.brand || 'Generic',
                category: local.category || 'General',
                barcode: local.barcode,
                price: local.price,
                source: 'DummyData',
                description: `${local.name} - ${local.qtyUnit}`,
                netWeight: local.qtyUnit,
                servingSize: '',
                ingredients: [],
                nutritionFacts: {},
                images: [],
                confidence: 100
            });
        }

        // Priority 2: Try UPCitemdb API with detailed extraction
        try {
            console.log('🌐 Trying UPCitemdb API...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const url = `https://api.upcitemdb.com/v2/lookup?upc=${encodeURIComponent(barcode)}`;
            const resp = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'PantryPal-App/1.0',
                    'Accept': 'application/json'
                }
            });
            clearTimeout(timeoutId);

            console.log(`📊 UPCitemdb response status: ${resp.status}`);

            if (resp.ok) {
                const data = await resp.json();
                console.log(`📊 UPCitemdb response data:`, JSON.stringify(data, null, 2));

                if (data && data.total > 0 && data.items && data.items.length > 0) {
                    const item = data.items[0];
                    const name = item.title || item.description || 'Unknown Product';
                    const brand = item.brand || 'Unknown Brand';
                    const quantityLabel = item.size || '';

                    // Enhanced category detection
                    let category = 'General';
                    if (item.category) {
                        const categoryStr = item.category.toLowerCase();
                        if (categoryStr.includes('beauty') || categoryStr.includes('cosmetic')) category = 'Personal Care';
                        else if (categoryStr.includes('food') || categoryStr.includes('grocery')) category = 'Groceries';
                        else if (categoryStr.includes('dairy') || categoryStr.includes('milk')) category = 'Dairy';
                        else if (categoryStr.includes('beverage') || categoryStr.includes('drink')) category = 'Beverages';
                        else if (categoryStr.includes('snack') || categoryStr.includes('chips')) category = 'Snacks';
                        else if (categoryStr.includes('household') || categoryStr.includes('clean')) category = 'Household';
                        else if (categoryStr.includes('bakery') || categoryStr.includes('bread')) category = 'Bakery';
                        else if (categoryStr.includes('pharma') || categoryStr.includes('medicine')) category = 'Medicines';
                        else if (categoryStr.includes('organic') || categoryStr.includes('bio')) category = 'Organic';
                        else category = item.category;
                    }

                    // Extract detailed product information
                    const description = item.description || `${name} - ${brand} ${quantityLabel}`.trim();
                    const netWeight = item.size || '';
                    const servingSize = ''; // UPCitemdb doesn't provide serving size
                    const ingredients = []; // UPCitemdb doesn't provide ingredients
                    const nutritionFacts = {}; // UPCitemdb doesn't provide nutrition facts

                    // Extract images
                    const images = [];
                    if (item.images && Array.isArray(item.images)) {
                        item.images.forEach((img, index) => {
                            images.push({ type: `image_${index + 1}`, url: img });
                        });
                    }

                    // Get lowest price if available
                    let lowestPrice = null;
                    if (item.offers && Array.isArray(item.offers)) {
                        const prices = item.offers
                            .filter(offer => offer.price && !isNaN(parseFloat(offer.price)))
                            .map(offer => parseFloat(offer.price));
                        if (prices.length > 0) {
                            lowestPrice = Math.min(...prices);
                        }
                    }

                    console.log(`✅ Found in UPCitemdb: ${name} (${brand})`);

                    return res.json({
                        name,
                        fullName: name,
                        quantityLabel,
                        qtyUnit: quantityLabel,
                        qty: 1,
                        brand,
                        category,
                        barcode: barcode,
                        price: lowestPrice,
                        source: 'UPCitemdb',
                        description,
                        netWeight,
                        servingSize,
                        ingredients,
                        nutritionFacts,
                        images,
                        confidence: 85
                    });
                } else {
                    console.log('📊 UPCitemdb: No items found in response');
                }
            } else {
                console.log(`📊 UPCitemdb HTTP error: ${resp.status} ${resp.statusText}`);
            }
        } catch (upcError) {
            console.log('⚠️ UPCitemdb lookup failed:', upcError.message);
        }
        // If nothing found, return enhanced not found response
        console.log(`❌ Product not found for barcode: ${barcode}`);
        return res.json({
            name: '',
            fullName: '',
            quantityLabel: '',
            qtyUnit: '',
            qty: 0,
            brand: 'Unknown',
            category: 'General',
            barcode: barcode,
            price: null,
            source: 'NotFound',
            description: `Product with barcode ${barcode} not found`,
            netWeight: '',
            servingSize: '',
            ingredients: [],
            nutritionFacts: {},
            images: [],
            confidence: 0
        });

    } catch (e) {
        console.error('❌ Barcode lookup error:', e.message);
        res.status(500).json({
            message: "Lookup error",
            error: e.message,
            name: '',
            fullName: '',
            quantityLabel: '',
            qtyUnit: '',
            qty: 0,
            brand: 'Error',
            category: 'General',
            barcode: barcode,
            price: null,
            source: 'Error',
            description: `Error occurred: ${e.message}`,
            netWeight: '',
            servingSize: '',
            ingredients: [],
            nutritionFacts: {},
            images: [],
            confidence: 0
        });
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
        let customerUser = null;
        if (useMongoDB) {
            const allUsers = await User.find();
            customerUser = allUsers.find(u => normalizePhone(u.phone) === phone);
        } else {
            customerUser = USERS_DB.find(u => normalizePhone(u.phone) === phone);
        }
        if (customerUser?.email) {
            const lines = items.slice(0, 10).map((it, i) => `${i + 1}. ${it.name} x${it.units || 1} — Rs.${(it.total || 0).toFixed(2)}`);
            const more = items.length > 10 ? `\n... and ${items.length - 10} more item(s)` : '';
            const body = `Hi ${customerUser.name},\n\nThank you for shopping with PantryPal+ retailer.\n\nItems purchased:\n${lines.join('\n')}${more}\n\nTotal: Rs.${totalAmount.toFixed(2)}\nPasscode: ${passcode}\n\nWelcome to PantryPal+. Login with your phone number in the PantryPal+ app and paste this passcode to see and manage your products.\n\nThank you!`;
            sendEmail(customerUser.email, 'PantryPal+ Purchase Confirmation', body).catch(() => { });
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

// --- AI Recipe Recommendations ---
app.post('/api/recipes/recommend', auth, async (req, res) => {
    try {
        const { ingredients, apiKey } = req.body;
        
        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ message: "List of ingredients required" });
        }

        console.log(`🥘 Generating AI recipe recommendations for ingredients: ${ingredients.join(', ')}`);
        
        // 1. Use Endee vector search to find matching dummy recipes as context (RAG)
        const recommendations = await searchRecipes(ingredients, 3);
        
        const { GoogleGenAI } = require('@google/genai');
        const activeKey = apiKey || process.env.GEMINI_API_KEY;

        if (activeKey) {
            // --- EMERGENCY MOCK FOR DEMONSTRATION TO BYPASS 429 QUOTA ---
            console.log("[DEMO MODE] Bypassing Gemini API due to Quota Exhaustion for demonstration.");
             
             // Instead of using Gemini which will throw 429, we directly format the highest scoring Endee result as the dynamic recipe
             if (recommendations && recommendations.length > 0) {
                 const bestMatch = recommendations[0];
                 return res.json({
                    success: true,
                    message: "Recipes directly matched via Endee Semantic Search",
                    recipes: [{
                        id: 'dynamic_recipe_mock',
                        title: bestMatch.title,
                        ingredients: bestMatch.ingredients,
                        instructions: bestMatch.instructions,
                        score: bestMatch.score || 0.95
                    }]
                });
             } else {
                 return res.json({
                    success: true,
                    message: "Fallback recipe generation",
                    recipes: [{
                        id: 'fallback_recipe_mock',
                        title: "Pantry Surprise Mix",
                        ingredients: ingredients.join(', ') + ", salt, pepper, oil",
                        instructions: "1. Heat oil in a pan. 2. Toss all ingredients together until cooked. 3. Serve hot!",
                        score: 0.85
                    }]
                });
             }

            // try {
            //     const ai = new GoogleGenAI({ apiKey: activeKey });
            //     const endeeContext = recommendations.map(r => `Title: ${r.title}\nIngredients: ${r.ingredients}\nInstructions: ${r.instructions}`).join('\n\n');
                
            //     const prompt = `You are a professional chef. ...`;

            //     const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
                
            //     // Parse the JSON response
            //     let txt = response.text.replace(/```json/gi, '').replace(/```JSON/gi, '').replace(/```/g, '').trim();
            //     const customRecipe = JSON.parse(txt);

            //     return res.json({ ... });
            // } catch (err) {
            //     console.error('Gemini RAG failed, falling back to pure Endee results:', err);
            // }
        }

        // 2. Fallback to just Endee results if no API key or Gemini fails
        res.json({
            success: true,
            message: "Recipes found via Endee AI Semantic Search",
            recipes: recommendations
        });
        
    } catch (e) {
        console.error('❌ Recipe Recommendation Error:', e);
        res.status(500).json({ 
            success: false, 
            message: "Failed to generate recipes. Is Endee server running?",
            error: e.message 
        });
    }
});

