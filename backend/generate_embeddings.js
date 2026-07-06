const fs = require("fs");
// INDUSTRY STANDARD: Using local Hugging Face SLMs in Node.js
const { pipeline } = require("@xenova/transformers");

async function vectorizeMenu() {
  console.log("📖 Loading menu.json...");

  // Read our synthetic menu
  const rawData = fs.readFileSync("menu.json", "utf8");
  const menuItems = JSON.parse(rawData);
  const menuWithVectors = [];

  console.log(`🚀 Downloading and loading local SLM (all-MiniLM-L6-v2)...`);
  console.log(
    `(This may take a few seconds on the very first run to download the tiny model)`,
  );

  // Load a tiny, highly efficient Hugging Face embedding model locally
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
  );

  console.log(
    `🧠 Model loaded! Starting embedding generation for ${menuItems.length} items...\n`,
  );

  // Notice there is NO DELAY here. We are running locally, so there are no rate limits!
  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i];

    // Create a rich text representation
    const textToEmbed = `
      Name: ${item.name}
      Description: ${item.description}
      Dietary: ${item.dietary.is_vegan ? "Vegan" : ""} ${item.dietary.is_halal ? "Halal" : ""} ${item.dietary.is_kosher ? "Kosher" : ""}
      Allergens: ${item.allergens.join(", ")}
    `.trim();

    try {
      // Generate the vector locally on your CPU
      const output = await extractor(textToEmbed, {
        pooling: "mean",
        normalize: true,
      });

      // Convert the Float32Array output to a standard JavaScript Array
      const vector = Array.from(output.data);

      // Attach the vector array to our menu item
      menuWithVectors.push({
        ...item,
        embedding: vector,
      });

      console.log(`✅ Embedded [${i + 1}/${menuItems.length}]: ${item.name}`);
    } catch (error) {
      console.error(`❌ Failed to embed item ${item.name}:`, error.message);
    }
  }

  // Save the new AI-ready database
  fs.writeFileSync(
    "menu_with_vectors.json",
    JSON.stringify(menuWithVectors, null, 2),
  );
  console.log(
    "\n🎉 Success! Created 'menu_with_vectors.json' bypassing cloud limits!",
  );
}

vectorizeMenu();
