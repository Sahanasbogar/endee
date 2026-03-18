// Endee will be dynamically imported
let Endee, Precision;
let client;

const INDEX_NAME = 'recipes';
const DIMENSION = 384; // all-MiniLM-L6-v2 dimension

// Dummy Recipe Data
const dummyRecipes = [
    {
        id: 'recipe_1',
        title: 'Classic Omelet',
        ingredients: 'eggs, butter, salt, pepper, cheese',
        instructions: 'Beat eggs. Melt butter in pan. Pour eggs. Add cheese. Fold and serve.',
    },
    {
        id: 'recipe_2',
        title: 'Avocado Toast',
        ingredients: 'bread, avocado, salt, lemon, olive oil',
        instructions: 'Toast bread. Mash avocado with salt and lemon. Spread on toast. Drizzle with olive oil.',
    },
    {
        id: 'recipe_3',
        title: 'Tomato Basil Pasta',
        ingredients: 'pasta, tomatoes, basil, garlic, olive oil, parmesan',
        instructions: 'Boil pasta. Sauté garlic and tomatoes. Mix with pasta. Top with basil and parmesan.',
    },
    {
        id: 'recipe_4',
        title: 'Banana Smoothie',
        ingredients: 'banana, milk, honey, ice',
        instructions: 'Blend all ingredients until smooth.',
    },
    {
        id: 'recipe_5',
        title: 'Chicken Stir Fry',
        ingredients: 'chicken breast, soy sauce, broccoli, carrots, oil',
        instructions: 'Cook chicken in oil. Add veggies and soy sauce. Stir fry until tender.',
    },
    {
        id: 'recipe_6',
        title: 'Peanut Butter Sandwich',
        ingredients: 'bread, peanut butter, jelly',
        instructions: 'Spread peanut butter on one slice, jelly on the other. Combine.',
    },
    {
        id: 'recipe_7',
        title: 'Caprese Salad',
        ingredients: 'mozzarella, tomatoes, basil, balsamic glaze',
        instructions: 'Layer mozzarella and tomatoes. Top with basil and drizzle with balsamic glaze.',
    },
    {
        id: 'recipe_8',
        title: 'Oatmeal',
        ingredients: 'oats, milk, honey, berries',
        instructions: 'Cook oats in milk. Top with honey and fresh berries.',
    },
    {
        id: 'recipe_9',
        title: 'Grilled Cheese',
        ingredients: 'bread, butter, cheese',
        instructions: 'Butter bread. Place cheese between slices. Grill until golden and melted.',
    },
    {
        id: 'recipe_10',
        title: 'Apple Slices with Peanut Butter',
        ingredients: 'apple, peanut butter',
        instructions: 'Slice apple. Dip in peanut butter.',
    }
];

// Initialize Model and Endee Index
async function initRecipeAI() {
    try {
        if (!client) {
            const endeeMod = await import('endee');
            Endee = endeeMod.Endee;
            Precision = endeeMod.Precision;
            
            client = new Endee();
            client.setBaseUrl('http://127.0.0.1:8080/api/v1');
        }

        console.log('[AI] Loading embedding model (Xenova)...');
        const transformers = await import('@xenova/transformers');
        const pipeline = transformers.pipeline;
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('[AI] Model loaded successfully!');

        console.log(`[AI] Checking/Creating Endee index: ${INDEX_NAME}`);
        try {
            await client.createIndex({
                name: INDEX_NAME,
                dimension: DIMENSION,
                spaceType: 'cosine',
                precision: Precision.FLOAT32, // Float32 for best accuracy
            });
            console.log(`[AI] Index ${INDEX_NAME} created.`);
        } catch (err) {
            // Index likely already exists
            console.log(`[AI] Index ${INDEX_NAME} might already exist or error:`, err.message);
        }

        const index = await client.getIndex(INDEX_NAME);

        console.log(`[AI] Upserting ${dummyRecipes.length} dummy recipes...`);
        const vectorsToInsert = [];

        for (const recipe of dummyRecipes) {
            // Create a semantic representation of the recipe
            const textToEmbed = `${recipe.title}. Ingredients: ${recipe.ingredients}.`;
            const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
            
            // output.data is a Float32Array containing the embeddings
            const vector = Array.from(output.data);

            vectorsToInsert.push({
                id: recipe.id,
                vector: vector,
                meta: {
                    title: recipe.title,
                    ingredients: recipe.ingredients,
                    instructions: recipe.instructions
                }
            });
        }

        await index.upsert(vectorsToInsert);
        console.log(`[AI] Upsert complete! Recipe AI is ready.`);

    } catch (error) {
        console.error('[AI] Initialization failed:', error);
    }
}

// Perform Semantic Search
async function searchRecipes(userIngredients, limit = 3) {
    if (!extractor || !client) {
        throw new Error('AI Model or Endee client not initialized yet.');
    }

    try {
        console.log(`[AI] Searching for recipes with ingredients: ${userIngredients}`);
        
        // Embed the search query
        const queryText = `Ingredients: ${userIngredients.join(', ')}`;
        const output = await extractor(queryText, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(output.data);

        // Query Endee
        const index = await client.getIndex(INDEX_NAME);
        const results = await index.query({
            vector: queryVector,
            topK: limit
        });

        // Map results back to recipe metadata
        return results.map(r => ({
            id: r.id,
            score: r.similarity || r.score, // Handle both potential response formats
            title: r.meta.title,
            ingredients: r.meta.ingredients,
            instructions: r.meta.instructions
        }));

    } catch (error) {
        console.error('[AI] Search error:', error);
        throw error;
    }
}

module.exports = {
    initRecipeAI,
    searchRecipes
};
