require("dotenv").config();
const OpenAI = require("openai");
const { pipeline } = require("@xenova/transformers");

const cerebras = new OpenAI({
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: "https://api.cerebras.ai/v1",
  timeout: 30000,
});

const dualIntentSchema = {
  type: "object",
  properties: {
    interaction_type: {
      type: "string",
      enum: ["INQUIRY", "ORDER"],
      description:
        "Classify if the user is asking a question (INQUIRY) or placing food items to buy (ORDER).",
    },
    customer_intent: {
      type: "string",
      description: "A brief summary of their goal.",
    },
    extracted_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item_name: { type: "string" },
          quantity: { type: "integer" },
          special_instructions: { type: "string" },
        },
        required: ["item_name", "quantity", "special_instructions"],
      },
    },
  },
  required: ["interaction_type", "customer_intent"],
};

async function processDriveThruInteraction(messyTranscript, db) {
  let extractor;
  try {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

    console.log("🧠 Step 1: Extracting with Cerebras (gpt-oss-120b)...");

    const systemPrompt = `You are a drive-thru AI assistant. Output ONLY raw, valid JSON matching this schema: ${JSON.stringify(dualIntentSchema)}`;

    const response = await cerebras.chat.completions.create({
      model: "gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze: "${messyTranscript}"` },
      ],
      temperature: 0.1,
    });

    let rawText = response.choices[0].message.content.trim();

    // SAFE CLEANING: Using character codes to avoid markdown parser interference
    const bt = String.fromCharCode(96);
    const pattern = new RegExp(
      "^" + bt + bt + bt + "(?:json)?\\n?|" + bt + bt + bt + "$",
      "gi",
    );
    rawText = rawText.replace(pattern, "").trim();

    const aiResponse = JSON.parse(rawText);

    if (aiResponse.interaction_type === "INQUIRY") {
      const output = await extractor(aiResponse.customer_intent, {
        pooling: "mean",
        normalize: true,
      });
      const queryVector = Array.from(output.data);

      const suggestions = await db
        .collection("menu")
        .aggregate([
          {
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryVector,
              numCandidates: 100,
              limit: 3,
            },
          },
          {
            $project: {
              _id: 0,
              name: 1,
              price: 1,
              description: 1,
              score: { $meta: "vectorSearchScore" },
            },
          },
        ])
        .toArray();

      return {
        type: "INQUIRY_RESULT",
        intent: aiResponse.customer_intent,
        suggestions,
      };
    }

    if (aiResponse.interaction_type === "ORDER") {
      const finalizedOrder = {
        customer_intent: aiResponse.customer_intent,
        total_price: 0,
        items: [],
      };

      for (const item of aiResponse.extracted_items || []) {
        const output = await extractor(item.item_name, {
          pooling: "mean",
          normalize: true,
        });
        const queryVector = Array.from(output.data);

        const searchResults = await db
          .collection("menu")
          .aggregate([
            {
              $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryVector,
                numCandidates: 50,
                limit: 1,
              },
            },
            { $project: { id: 1, name: 1, price: 1 } },
          ])
          .toArray();

        if (searchResults.length > 0) {
          const bestMatch = searchResults[0];
          finalizedOrder.items.push({
            db_id: bestMatch.id,
            name: bestMatch.name,
            quantity: item.quantity,
            special_instructions: item.special_instructions,
            unit_price: parseFloat(bestMatch.price),
            line_total: parseFloat(bestMatch.price) * item.quantity,
          });
          finalizedOrder.total_price +=
            parseFloat(bestMatch.price) * item.quantity;
        }
      }
      return { type: "ORDER_CONFIRMATION_NEEDED", payload: finalizedOrder };
    }
  } catch (error) {
    console.error("❌ Agent Error:", error);
    throw error;
  }
}

module.exports = { processDriveThruInteraction };
