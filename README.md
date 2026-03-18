# PantryPal+ AI: Smart Recipe Recommendations with Endee Vector Database

This repository contains the complete codebase for **PantryPal+ AI**, a comprehensive inventory management and consumer grocery tracking application newly overhauled with an **AI Semantic Recipe Recommendation Engine** built on top of the **Endee Vector Database**.

This project was built and submitted as part of the Endee Evaluation Assignment.

## 🚀 Project Overview
PantryPal+ is a dual-interface application:
1. **Retailer App:** Manages store inventory, automates discounts for expiring items, and processes POS transactions.
2. **Customer App:** Consumers claim their digital receipts via SMS passcodes, track at-home expiry dates to prevent food waste, and—crucially—receive **AI-powered recipe recommendations** based on their available pantry ingredients.

### The AI/ML Use Case: Semantic Recipe Search
To combat food waste, we want to suggest recipes to users based on the ingredients they have stretching near expiration. 
Traditional exact-keyword searches fail here (e.g., searching "beef" doesn't return recipes for "steak" or "ground chuck").

**Instead, we used Endee as a Vector Database for Semantic Search:**
1. We pre-loaded the Endee vector database with recipes.
2. We used the `@xenova/transformers` library (specifically the `Xenova/all-MiniLM-L6-v2` local ONNX model) to convert recipe texts into 384-dimensional vector embeddings.
3. When a user queries "What can I cook with eggs and cheese?", the Node.js backend converts the query into a vector.
4. The backend queries the local **Endee Vector Database** via the `@endee/client` Node.js SDK for the closest cosine-similarity match.
5. Endee returns the most semantically relevant recipes in milliseconds!

## 🧠 System Architecture & Design
- **Vector Database:** Endee (Running locally via Docker)
- **Machine Learning Layer:** Node.js with `@xenova/transformers` (Local ONNX inferences, zero API cost)
- **Backend API:** Express.js (Handles inventory, users, and the `/api/recipes/recommend` AI route)
- **Frontend UI:** React.js / Tailwind CSS
- **Traditional DB:** MongoDB (Fallback to local JSON)

## 🛠 Setup & Evaluation Instructions

### Prerequisites
- Docker Desktop must be running (to host Endee).
- Node.js (v18+)

### Step 1: Start the Endee Vector Database
Endee is required for the Semantic Search functionality. Open a terminal in the root of this repository and run it via native Linux or WSL:
```bash
./run.sh
# Or, if running on Windows via WSL:
wsl ./run.sh
```
*(Alternatively, you can run `docker compose up -d` if you prefer Docker).*  
*Endee runs natively on `http://127.0.0.1:8080`.*

### Step 2: Start the PantryPal Backend
Open a new terminal and navigate to the backend directory:
```bash
cd pantry-backend
npm install
npm start
```
*The backend runs on `http://localhost:5000`. On startup, it will automatically connect to Endee, download the ML model, create the `recipes` index, and upsert the testing recipes.*

### Step 3: Start the PantryPal Frontend
Open a new terminal and navigate to the frontend directory:
```bash
cd pantrypal
npm install
npm start
```
*The React app runs on `http://localhost:3000`.*

### Step 4: Test the AI Feature
1. Open `http://localhost:3000` in your browser.
2. Click **Customer App** (or use the Quick Demo Bypass).
3. If your virtual pantry is empty, claim a receipt or use the demo data.
4. Click the **"Suggest Recipe from My Purchases"** button in the Customer Dashboard.
5. The frontend sends your ingredients to the backend, which vectors the text via Transformers, queries Endee, and returns the AI recipe match!

## 📜 Repository Structure
- `/endee` - The core C++ Endee engine (as forked from the original repo).
- `/pantry-backend` - The Node.js application. See `recipeAi.js` for the exact implementation of the Endee SDK and Transformers logic.
- `/pantrypal` - The React frontend application.

---
*Built with ❤️ utilizing the open-source power of Endee.*
