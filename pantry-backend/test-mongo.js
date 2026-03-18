/**
 * Run: node test-mongo.js
 * Use this to verify your MongoDB Atlas connection before starting the server.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || process.env.DATABASE_URL;

async function test() {
    console.log('Testing MongoDB connection...\n');
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        console.log('✅ SUCCESS! MongoDB Atlas is connected.');
        console.log('   You can now run: node server.js\n');
    } catch (err) {
        console.log('❌ Connection failed:', err.message);
        if (err.message.includes('whitelist') || err.message.includes('IP')) {
            console.log('\n👉 FIX: Add your IP in MongoDB Atlas:');
            console.log('   1. Go to https://cloud.mongodb.com');
            console.log('   2. Left menu → Network Access');
            console.log('   3. Click "Add IP Address"');
            console.log('   4. Click "Allow Access from Anywhere"');
            console.log('   5. Confirm, wait 2 min, run this again\n');
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('querySrv')) {
            console.log('\n👉 Check your DATABASE_URL in .env - use mongodb:// not mongodb+srv://\n');
        }
        process.exit(1);
    }
    process.exit(0);
}
test();
