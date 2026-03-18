const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'pantry-data.json');

function load() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        return { users: parsed.users || [], inventory: parsed.inventory || [], purchases: parsed.purchases || [] };
    } catch (e) {
        return { users: [], inventory: [], purchases: [] };
    }
}

function save(users, inventory, purchases) {
    try {
        const data = { users, inventory, purchases: purchases || [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Could not save data:', e.message);
    }
}

module.exports = { load, save };
