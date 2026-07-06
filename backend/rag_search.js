require("dotenv").config();
const { MongoClient } = require("mongodb");
// INDUSTRY STANDARD: Using the same local SLM for queries
const { pipeline } = require("@xenova/transformers");

async function searchMenuWithMongoDB(userQuery) {
  console.log(`\n🗣️ Customer asked: "${userQuery}"`);
  console.log("🧠 Turning query into vector...");

  // 1. Generate the embedding for the query using the local SLM
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
  );
  const output = await extractor(userQuery, {
    pooling: "mean",
    normalize: true,
  });
  const queryVector = Array.from(output.data);

  console.log("☁️ Searching MongoDB Vector Database...");
  const client = new MongoClient(process.env.MONGO_URI);

  try {
    await client.connect();
    const db = client.db("agentic-eats");
    const collection = db.collection("menu");

    // 2. Perform the Vector Search in the cloud using the aggregation pipeline
    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: "vector_index", // This matches the index we created in Atlas
            path: "embedding",
            queryVector: queryVector,
            numCandidates: 100, // Look at all 100 items
            limit: 3, // Return the top 3 closest matches
          },
        },
        {
          // 3. Clean up the output. We don't need to download the massive vector arrays back to our app.
          $project: {
            _id: 0,
            name: 1,
            price: 1,
            description: 1,
            dietary: 1,
            allergens: 1,
            score: { $meta: "vectorSearchScore" }, // Extract MongoDB's internal match score
          },
        },
      ])
      .toArray();

    console.log("\n🍽️ Top 3 Recommendations found by MongoDB Vector Search:");
    console.log("-----------------------------------------------------");

    results.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} | $${item.price}`);
      console.log(`   Match Score: ${(item.score * 100).toFixed(1)}%`);
      console.log(
        `   Dietary: ${item.dietary.is_vegan ? "Vegan" : "Not Vegan"}, Allergens: ${item.allergens.length > 0 ? item.allergens.join(", ") : "None"}`,
      );
      console.log(`   Description: ${item.description}\n`);
    });

    return results;
  } catch (error) {
    console.error("❌ MongoDB Vector Search Error:", error);
  } finally {
    await client.close();
  }
}

// --- TEST THE PRODUCTION RAG SYSTEM ---
// Try changing this string to test different weird queries!
const testQuery =
  "I need something completely plant based with no dairy or meat.";

searchMenuWithMongoDB(testQuery);
