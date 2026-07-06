require("dotenv").config();
const { MongoClient } = require("mongodb");
const fs = require("fs");

async function seedDatabase() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ ERROR: MONGO_URI is missing from your .env file!");
    return;
  }

  const client = new MongoClient(uri);

  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await client.connect();
    console.log("✅ Connected securely!");

    // Create a database called 'agentic-eats' and a collection called 'menu'
    const db = client.db("agentic-eats");
    const collection = db.collection("menu");

    // Read the local file with the vectors
    const rawData = fs.readFileSync("menu_with_vectors.json", "utf8");
    const menuItems = JSON.parse(rawData);

    // Clear out any old data so we don't get duplicates if you run this twice
    console.log("🧹 Clearing old menu data...");
    await collection.deleteMany({});

    console.log(`📤 Uploading ${menuItems.length} items to the cloud...`);
    const result = await collection.insertMany(menuItems);

    console.log(
      `🎉 Success! Uploaded ${result.insertedCount} items into MongoDB Atlas.`,
    );
  } catch (error) {
    console.error("❌ MongoDB Error:", error);
  } finally {
    await client.close();
    console.log("👋 Disconnected.");
  }
}

seedDatabase();
