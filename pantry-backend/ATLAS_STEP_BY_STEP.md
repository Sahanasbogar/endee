# MongoDB Atlas Setup — Complete Beginner Guide

Follow these steps exactly. Do them in order.

---

## STEP 1: Open MongoDB Atlas

1. Open your browser (Chrome, Edge, etc.)
2. Go to: **https://cloud.mongodb.com**
3. Log in with your MongoDB account (email + password)
4. You should see your **Dashboard**

---

## STEP 2: Select the Correct Project

1. Look at the **top-left** of the screen
2. You'll see a dropdown that says something like "Project 0" or your project name
3. Click it and make sure you're in the project that has your cluster (Cluster0)
4. If you're not sure, just stay in the default project

---

## STEP 3: Open Network Access

1. On the **left sidebar**, find the **Security** section
2. Under Security, click **"Network Access"**
3. You'll see a page titled "Network Access" with a list of IP addresses (or it might be empty)
4. Click the green **"Add IP Address"** button (top right)

---

## STEP 4: Add Your IP — Two Options (Use BOTH)

### Option A: Allow All IPs (Recommended first)

1. A popup window appears
2. Click the button: **"Allow Access from Anywhere"**
3. You'll see the address change to: `0.0.0.0/0`
4. In the "Comment" box, type: `PantryPal`
5. Click **"Confirm"**
6. Wait for the new entry to show **"Active"** (green status) — usually 1–2 minutes

### Option B: Add Your Specific IP Too

1. Click **"Add IP Address"** again
2. This time click **"Add Current IP Address"**
3. It will fill in your IP (e.g. 205.254.184.146)
4. Click **"Confirm"**
5. Wait for it to show **"Active"**

---

## STEP 5: Verify the Entries

On the Network Access page, you should now see:

| IP Address    | Status  | Comment   |
|---------------|---------|-----------|
| 0.0.0.0/0     | ACTIVE  | PantryPal |
| 205.254.184.146 | ACTIVE | (optional) |

- If status says **"Updating"** — wait 2–3 minutes
- If status says **"Active"** — you're done with this step!

---

## STEP 6: Check Database User

1. On the left sidebar, under Security, click **"Database Access"**
2. You should see a user (e.g. `sahanasbogar555_db_user`)
3. Click on that user
4. Make sure it has the role: **"Atlas admin"** or **"Read and write to any database"**
5. If you're not sure, click **"Edit"** → Add "Atlas admin" role → Save

---

## STEP 7: Check Your Cluster is Running

1. On the left sidebar, click **"Database"** (or go back to the main dashboard)
2. You should see your cluster (Cluster0)
3. Make sure it says **"Active"** — if it says **"Paused"**, click **"Resume"** and wait 2 minutes

---

## STEP 8: Wait 2–3 Minutes

**Important:** After adding IP addresses, Atlas needs 2–3 minutes to apply changes.

- Grab a glass of water
- Come back after 2–3 minutes

---

## STEP 9: Test the Connection

1. Open PowerShell (or your terminal)
2. Go to your backend folder:
   ```
   cd C:\Users\sahan\OneDrive\Desktop\pantry\pantry-backend
   ```
3. Run:
   ```
   node test-mongo.js
   ```

### If you see:
```
✅ SUCCESS! MongoDB Atlas is connected.
```
**You're done!** Run `node server.js` and your app will use the cloud database.

### If you still see an error:
- Wait 2 more minutes and try again
- Make sure BOTH IP entries (0.0.0.0/0 and your IP) show **Active**
- Try from your phone's mobile hotspot (your Wi-Fi might block MongoDB)

---

## Quick Summary

| Step | Action |
|------|--------|
| 1 | Go to cloud.mongodb.com, log in |
| 2 | Left menu → Network Access |
| 3 | Add IP Address → Allow Access from Anywhere → Confirm |
| 4 | Add IP Address → Add Current IP Address → Confirm |
| 5 | Wait 2–3 minutes |
| 6 | Run: `node test-mongo.js` |

---

Need help? Screenshot your Network Access page and share — we can check if something looks wrong.
