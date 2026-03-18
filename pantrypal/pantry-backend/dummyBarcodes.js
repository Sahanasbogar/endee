const DUMMY_PRODUCTS = [
  { name: "Basmati Rice", barcode: "8901234600001", category: "Groceries", qty: 75, qtyUnit: "1 kg", price: 95 },
  { name: "Basmati Rice", barcode: "8901234600002", category: "Groceries", qty: 40, qtyUnit: "5 kg", price: 450 },
  { name: "Toor Dal", barcode: "8901234600003", category: "Groceries", qty: 60, qtyUnit: "1 kg", price: 120 },
  { name: "Toor Dal", barcode: "8901234600004", category: "Groceries", qty: 25, qtyUnit: "3 kg", price: 340 },
  { name: "Groundnut Oil", barcode: "8901234600005", category: "Cooking Essentials", qty: 50, qtyUnit: "1 liter", price: 170 },
  { name: "Groundnut Oil", barcode: "8901234600006", category: "Cooking Essentials", qty: 18, qtyUnit: "5 liter", price: 820 },
  { name: "Curd", barcode: "8901234600007", category: "Dairy", qty: 90, qtyUnit: "500 g", price: 35 },
  { name: "Paneer", barcode: "8901234600008", category: "Dairy", qty: 55, qtyUnit: "200 g", price: 85 },
  { name: "Paneer", barcode: "8901234600009", category: "Dairy", qty: 35, qtyUnit: "1 kg", price: 420 },
  { name: "Cold Drink", barcode: "8901234600010", category: "Beverages", qty: 120, qtyUnit: "1 liter", price: 45 },
  { name: "Cold Drink", barcode: "8901234600011", category: "Beverages", qty: 80, qtyUnit: "2 liter", price: 85 },
  { name: "Namkeen Mixture", barcode: "8901234600012", category: "Snacks", qty: 150, qtyUnit: "250 g", price: 40 },
  { name: "Namkeen Mixture", barcode: "8901234600013", category: "Snacks", qty: 95, qtyUnit: "1 kg", price: 150 },
  { name: "Toothpaste", barcode: "8901234600014", category: "Personal Care", qty: 70, qtyUnit: "150 g", price: 95 },
  { name: "Shampoo", barcode: "8901234600015", category: "Personal Care", qty: 65, qtyUnit: "650 ml", price: 320 },
  { name: "Dishwash Liquid", barcode: "8901234600016", category: "Household", qty: 85, qtyUnit: "500 ml", price: 110 },
  { name: "Detergent Powder", barcode: "8901234600017", category: "Household", qty: 45, qtyUnit: "2 kg", price: 210 },
  { name: "Detergent Powder", barcode: "8901234600018", category: "Household", qty: 30, qtyUnit: "5 kg", price: 480 },

  { name: "Maida", barcode: "8901234610001", category: "Groceries", qty: 65, qtyUnit: "1 kg", price: 48 },
  { name: "Maida", barcode: "8901234610002", category: "Groceries", qty: 30, qtyUnit: "3 kg", price: 135 },
  { name: "Rava", barcode: "8901234610003", category: "Groceries", qty: 70, qtyUnit: "1 kg", price: 52 },
  { name: "Rava", barcode: "8901234610004", category: "Groceries", qty: 35, qtyUnit: "2 kg", price: 100 },
  { name: "Mustard Oil", barcode: "8901234610005", category: "Cooking Essentials", qty: 55, qtyUnit: "1 liter", price: 180 },
  { name: "Mustard Oil", barcode: "8901234610006", category: "Cooking Essentials", qty: 22, qtyUnit: "5 liter", price: 880 },
  { name: "Butter", barcode: "8901234610007", category: "Dairy", qty: 95, qtyUnit: "500 g", price: 245 },
  { name: "Cheese Block", barcode: "8901234610008", category: "Dairy", qty: 40, qtyUnit: "1 kg", price: 480 },
  { name: "Lays Chips", barcode: "8901234610009", category: "Snacks", qty: 180, qtyUnit: "50 g", price: 10 },
  { name: "Lays Chips", barcode: "8901234610010", category: "Snacks", qty: 120, qtyUnit: "150 g", price: 35 },
  { name: "Oreo Biscuits", barcode: "8901234610011", category: "Snacks", qty: 140, qtyUnit: "120 g", price: 30 },
  { name: "Good Day Biscuits", barcode: "8901234610012", category: "Snacks", qty: 110, qtyUnit: "200 g", price: 45 },
  { name: "Hand Sanitizer", barcode: "8901234610013", category: "Personal Care", qty: 75, qtyUnit: "250 ml", price: 99 },
  { name: "Face Wash", barcode: "8901234610014", category: "Personal Care", qty: 60, qtyUnit: "100 g", price: 140 },
  { name: "Floor Cleaner", barcode: "8901234610015", category: "Household", qty: 85, qtyUnit: "1 liter", price: 155 },
  { name: "Floor Cleaner", barcode: "8901234610016", category: "Household", qty: 40, qtyUnit: "2 liter", price: 290 },
  { name: "Tea Powder", barcode: "8901234610017", category: "Beverages", qty: 95, qtyUnit: "500 g", price: 260 },
  { name: "Tea Powder", barcode: "8901234610018", category: "Beverages", qty: 50, qtyUnit: "1 kg", price: 500 },
];

function lookupDummyBarcode(code) {
  const c = String(code || '').trim();
  return DUMMY_PRODUCTS.find(p => String(p.barcode) === c) || null;
}

module.exports = { lookupDummyBarcode };

