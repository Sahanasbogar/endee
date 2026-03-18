# Fix MongoDB Atlas Connection (5 minutes)

## Your app WORKS now (In-Memory mode). To enable MongoDB:

### Step 1: Open Atlas
- Go to: **https://cloud.mongodb.com**
- Log in with your MongoDB account

### Step 2: Network Access
- Click **"Network Access"** in the left sidebar (under Security)
- Click the green **"Add IP Address"** button

### Step 3: Add IP
- Select **"Allow Access from Anywhere"**
- It will show `0.0.0.0/0`
- Add a comment: `PantryPal` (optional)
- Click **"Confirm"**

### Step 4: Wait & Restart
- Wait **2 minutes** for Atlas to apply the change
- Stop your server (Ctrl+C)
- Run: `node server.js`

You should see: `✅ MongoDB Connected: pantrypal`

---

**If you can't access Atlas:** Your app already runs in In-Memory mode. Use it for your demo – register, add stock, everything works. Data just resets when you restart the server.
