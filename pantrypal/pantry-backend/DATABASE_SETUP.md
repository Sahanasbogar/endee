# PantryPal+ Database Setup (Grand Finale Ready)

Your backend now uses **MongoDB**. Choose one option:

---

## Option 1: MongoDB Atlas (Recommended – No Install)

1. Go to **https://www.mongodb.com/atlas** and sign up (free).
2. Create a **Free Cluster** (M0).
3. Click **Connect** → **Drivers** → copy the connection string.
4. Replace `<password>` with your database user password.
5. Add to `.env`:
   ```
   MONGO_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/pantrypal?retryWrites=true&w=majority
   ```
6. In Atlas: **Database Access** → Add user (username + password).  
   **Network Access** → Add IP `0.0.0.0` (or your IP) to allow connections.

---

## Option 2: Local MongoDB

1. Install: **https://www.mongodb.com/try/download/community**
2. Start MongoDB (on Windows: run `mongod` or start as a service).
3. `.env` should already have:
   ```
   MONGO_URI=mongodb://127.0.0.1:27017/pantrypal
   ```

---

## Run the App

```bash
# Backend
cd pantry-backend
npm start

# Frontend (separate terminal)
cd pantrypal
npm start
```

You should see: `✅ MongoDB Connected: pantrypal` and `🚀 Server running on port 5000 (MongoDB)`.
