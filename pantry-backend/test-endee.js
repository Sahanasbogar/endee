const { searchRecipes, initRecipeAI } = require('./recipeAi');

async function runTests() {
    console.log("🚀 Starting Endee Integration Tests...\n");

    try {
        console.log("1. Initializing Recipe AI (Connecting to Endee & Loading ML Model)...");
        await initRecipeAI();
        console.log("✅ Initialization successful!\n");

        console.log("2. Testing Semantic Search Query...");
        const userIngredients = ['chicken', 'rice', 'broccoli'];
        console.log(`Querying Endee for ingredients: ${userIngredients.join(', ')}`);
        
        const results = await searchRecipes(userIngredients);
        
        if (results && results.length > 0) {
            console.log(`✅ Success! Found ${results.length} semantic matches:`);
            results.forEach((r, idx) => {
                console.log(`   [${idx + 1}] Title: ${r.title} (Score: ${r.score})`);
                console.log(`       Ingredients: ${r.ingredients}`);
            });
        } else {
            console.log("⚠️ No matches found or search failed.");
        }

    } catch (err) {
        console.error("❌ Test Failed:", err.message);
    }
    
    console.log("\n🏁 Tests complete. Exiting...");
    process.exit(0);
}

runTests();
