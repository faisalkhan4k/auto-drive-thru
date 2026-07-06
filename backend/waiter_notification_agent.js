require("dotenv").config();
const OpenAI = require("openai");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");

const cerebras = new OpenAI({
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: "https://api.cerebras.ai/v1",
});

// Connects to our custom local MCP Server
async function sendGmailViaLocalMCP(email, subject, body) {
  console.log(`\n🔌 [MCP Client] Spawning Local Email Server...`);

  // We launch our own custom MCP server as a child process using Node
  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp_email_server.js"],
  });

  const client = new Client(
    { name: "waiter-ai-client", version: "1.0.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    console.log(
      `✅ [MCP Client] Connected! Asking server to execute 'send_receipt_email'...`,
    );

    const result = await client.callTool({
      name: "send_receipt_email",
      arguments: {
        to: email,
        subject: subject,
        body: body,
      },
    });

    console.log(`📠 [MCP Server Response]: ${result.content[0].text}`);
    return result;
  } catch (err) {
    console.error("❌ [MCP Client] Connection or Execution failed:", err);
  } finally {
    await client.close();
  }
}

async function generateAndSendReceipt(order) {
  if (!order.customerEmail || order.customerEmail.trim() === "") {
    console.log(
      "⚠️ Order completed, but customer declined a receipt (no email provided).",
    );
    return;
  }

  console.log(
    `\n🛎️ Waiter AI noticed Order #${order._id.toString().slice(-4)} is READY.`,
  );

  try {
    const prompt = `
        You are the friendly Waiter AI at Agentic Eats.
        An order has just been completed by the kitchen.
        
        Customer's Original Request: "${order.customer_intent}"
        Items Ordered: ${order.items.map((i) => i.quantity + "x " + i.name).join(", ")}
        Total Paid: $${order.total_price.toFixed(2)}
        
        Draft a short, fun, personalized email receipt to the customer. 
        Output ONLY the raw email text. Do not use placeholders, do not use markdown.
        `;

    const response = await cerebras.chat.completions.create({
      model: "gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const emailBody = response.choices[0].message.content.trim();

    // Dispatch via our Local MCP Server
    await sendGmailViaLocalMCP(
      order.customerEmail,
      "Your Agentic Eats Order is Ready! 🍔",
      emailBody,
    );

    return emailBody;
  } catch (error) {
    console.error("❌ Waiter Notification Error:", error);
  }
}

module.exports = { generateAndSendReceipt };
