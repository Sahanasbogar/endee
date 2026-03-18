# MongoDB Atlas Cloud Setup — PantryPal+

Your app **stores scanned products** and **alerts when items are near expiry**. Data stays in the cloud until you delete it.

---

## Step 1: Log into Atlas

Go to **https://cloud.mongodb.com** and sign in.

---

## Step 2: Add Network Access (IP Whitelist)

1. In the left sidebar, click **"Network Access"** (under the Security section).
2. Click the green **"Add IP Address"** button (top right).
3. In the popup:
   - Click **"Allow Access from Anywhere"**
   - This adds `0.0.0.0/0` (allows any IP)
   - Click **"Confirm"**
4. **Wait 2–3 minutes** for the change to apply.

---

## Step 3: Verify Database User

1. In the left sidebar, click **"Database Access"**.
2. Ensure you have a user (e.g. `sahanasbogar555_db_user`).
3. That user must have **Read and write to any database** (or at least to `pantrypal`).

---

## Step 4: Test the Connection

In the `pantry-backend` folder, run:

```bash
node test-mongo.js
```

- If you see **"SUCCESS! MongoDB Atlas is connected"** → run `node server.js`
- If it fails → go back to Step 2 and ensure the IP was added and you waited 2+ minutes.

---

## Step 5: Run Your App

```bash
node server.js
```

You should see:

```
✅ MongoDB Connected: pantrypal
🚀 Server running on port 5000 — ready for PantryPal+
```

Your scanned products and expiry alerts will now be stored in MongoDB Atlas until you delete them.
