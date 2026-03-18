# 🌟 PantryPal+ AI: Intelligent Inventory & Cooking Assistant

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Endee Vector DB](https://img.shields.io/badge/Powered%20By-Endee%20Vector%20DB-blue)
![React](https://img.shields.io/badge/Frontend-React%20v18-blue)
![NodeJS](https://img.shields.io/badge/Backend-Node.js%20Express-green)

Welcome to **PantryPal+ AI**, a comprehensive, dual-interface grocery management platform transformed by an **Endee-powered Semantic AI Engine**. This project combats global food waste by bridging the gap between supermarket inventory management and at-home consumer cooking.

Built and submitted for the **Endee.io Vector Database Evaluation Assignment**.

---

## 📖 1. Project Overview
PantryPal+ AI serves two distinct user groups within a seamless ecosystem:
- **🏪 Retailer B2B Portal:** Empowers store managers to track inventory ledgers, automate discount policies for expiring goods, and handle POS operations. Features a real-time **RAG (Retrieval-Augmented Generation) Chatbot** that queries live stock and official wholesale policies.
- **🛒 Consumer App:** Allows shoppers to claim digital receipts, track the at-home expiration dates of their groceries, and automatically discover **Semantically Matched Recipes** using the ingredients they already possess.

### The Problem Solved
Traditional keyword-based recipe engines fail when users search with vague or synonymous terms (e.g., searching "beef" won't yield recipes requiring "steak" or "ground chuck"). PantryPal+ AI leverages true semantic meaning to ensure zero food goes to waste.

---

## ⚡ 2. The AI/ML Use Case: How Endee Powers PantryPal+
This application utilizes **Endee**, a high-performance vector database, to drive two core Agentic AI workflows:

### A. Semantic Recipe Search engine
1. **Vectorization:** Thousands of complex recipes are embedded into 384-dimensional vector arrays using the local `@xenova/transformers` ONNX model (`Xenova/all-MiniLM-L6-v2`).
2. **Endee Upsertion:** These embeddings, alongside deep recipe metadata, are ingested natively into the Endee Database.
3. **Semantic Querying:** When a user asks *"What can I cook with eggs and old bread?"*, the Node.js backend vectorizes the human-language query and asks Endee for the closest Cosine-Similarity match.
4. **Instant Results:** Endee returns the most semantically relevant recipes in milliseconds without expensive external API calls.

### B. Retailer Policy RAG (Retrieval-Augmented Generation)
1. Official store return policies, markdown schedules, and shipping rules are embedded into Endee.
2. The B2B Wholesale Chatbot retrieves the most relevant policy based on the retailer's question, merges it with live MongoDB inventory ledgers, and generates a highly accurate, context-aware response.

---

## 🏗️ 3. System Architecture & System Design
PantryPal+ AI relies on a modernized hybrid-database stack to intelligently separate structured ledger data from complex AI embeddings.

- **Vector Database (AI/ML Context):** **Endee C++ Engine** (running locally via WSL/Native Linux for maximum performance)
- **Machine Learning Layer:** HuggingFace Transformers (`@xenova/transformers` handling zero-latency ONNX inferences)
- **Backend API Server:** Node.js, Express.js (RESTful architecture)
- **Transactional Database:** MongoDB (Fail-safe to Local JSON caching for robust uptime)
- **Frontend UI Client:** React.js, Tailwind CSS (Interactive Dashboards)

---

## 🚀 4. Setup & Running Instructions

### Prerequisites
- Node.js (v18+)
- Windows Subsystem for Linux (WSL) or Native Linux (Required to run the high-performance native Endee Engine)

### Step 1: Boot the Endee Vector Database
Endee must be running to handle the Semantic Search functionality. Open a terminal in the root of this repository:
```bash
# On Native Linux or WSL environment:
./run.sh

# Or if running from Windows Command Prompt/PowerShell via WSL:
wsl ./run.sh
```
*(Endee will securely initialize and listen for AI queries on `http://127.0.0.1:8080`)*

### Step 2: Initialize the Node.js Backend
Open a **new** terminal and navigate to the backend directory:
```bash
cd pantry-backend
npm install
npm start
```
*Note: On its very first startup, the backend will automatically connect to Endee, download the ML model, create the `recipes` index, and upsert the vector training data.*

### Step 3: Launch the React Frontend
Open a **third** terminal and navigate to the frontend directory:
```bash
cd pantrypal
npm install
npm start
```
*The Consumer and Retailer Dashboards will become available at `http://localhost:3000`.*

---

## 🧪 Quick Evaluation Guide
For evaluating the Endee integration seamlessly:
1. Open `http://localhost:3000` -> Click **Customer App**.
2. Assuming your virtual pantry has ingredients, click **"Suggest Recipe from My Purchases"**.
3. Watch the local Node.js console perfectly vectorize the request and query Endee to return semantic matches instantly!

---
*Built meticulously with ❤️ utilizing the incredible open-source power of Endee.*
