const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: 'AIzaSyCcYdiNhBztpWFsg_flgNVRUnAJotyWSfU' });

async function findModels() {
  try {
    const list = await ai.models.list();
    const suitable = [];
    for (const m of list.models || list) { // Handles SDK variations
       if (m.name.includes('gemini') && m.supportedActions && m.supportedActions.includes('generateContent')) {
           suitable.push(m.name);
       }
       if (m.name.includes('gemini') && m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
           suitable.push(m.name);
       }
    }
    const fs = require('fs');
    fs.writeFileSync('model_list_found.json', JSON.stringify(list, null, 2));
    console.log("Success! File written.");
  } catch (e) {
    console.error("Error:", e);
  }
}
findModels();
