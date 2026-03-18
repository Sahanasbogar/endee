const { GoogleGenAI } = require('@google/genai');
const https = require('https');

// The Mock Endee Database Engine
class EndeeMock {
  constructor() {
    this.vectors = []; // This stores the actual embeddings (the vectors)
    this.metadata = []; // This stores the text/info related to the vector
  }

  // 1. Convert text into a vector using Google Gemini REST API
  async generateEmbedding(text, apiKey) {
    console.log(`[Endee Mock] Generating embedding for: "${text.substring(0, 30)}..."`);
    try {
      return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: text }] }
        });

        const options = {
          hostname: 'generativelanguage.googleapis.com',
          port: 443,
          path: `/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const reqHttp = https.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.error) return reject(new Error(data.error.message || JSON.stringify(data.error)));
              if (!data.embedding || !data.embedding.values) return reject(new Error("Invalid API response format: Missing embedding values"));
              resolve(data.embedding.values);
            } catch (e) { reject(e); }
          });
        });

        reqHttp.on('error', reject);
        reqHttp.write(postData);
        reqHttp.end();
      });
    } catch (error) {
      console.error("[Endee Mock] Error generating embedding:", error);
      throw error;
    }
  }

  // 2. Insert the vector and its metadata into our "database"
  insert(vector, data) {
    this.vectors.push(vector);
    this.metadata.push(data);
    console.log(`[Endee Mock] Inserted vector. Total items: ${this.vectors.length}`);
  }

  // 3. The Math: Cosine Similarity between two vectors
  // This calculates "how close" two ideas are in multi-dimensional space.
  // 1.0 means exactly identical. 0.0 means completely unrelated.
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 4. Search the database for the closest vectors
  search(queryVector, topK = 3) {
    if (this.vectors.length === 0) return [];

    console.log(`[Endee Mock] Searching across ${this.vectors.length} vectors...`);
    
    // Calculate similarity between the query and EVERY item in the database
    const results = this.vectors.map((vec, index) => {
      return {
        score: this.cosineSimilarity(queryVector, vec),
        data: this.metadata[index] // The actual text/product info
      };
    });

    // Sort by highest score (closest meaning) first
    results.sort((a, b) => b.score - a.score);

    // Return the top K results
    return results.slice(0, topK);
  }
}

// Export a single instance to act as our global database memory
const db = new EndeeMock();
module.exports = db;
