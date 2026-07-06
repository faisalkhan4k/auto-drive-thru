require("dotenv").config();
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const nodemailer = require("nodemailer");

// 1. Initialize the custom MCP Server
const server = new Server(
  { name: "agentic-eats-email-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// 2. Define the Tools this server provides to AI clients
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "send_receipt_email",
        description:
          "Sends an order confirmation receipt to a customer's email address.",
        inputSchema: {
          type: "object",
          properties: {
            to: { type: "string", description: "The customer's email address" },
            subject: { type: "string", description: "The email subject line" },
            body: {
              type: "string",
              description: "The raw text body of the email receipt",
            },
          },
          required: ["to", "subject", "body"],
        },
      },
    ],
  };
});

// 3. Execute the Tool when the AI requests it
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "send_receipt_email") {
    const { to, subject, body } = request.params.arguments;

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: `"Agentic Eats MCP" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: subject,
        text: body,
      });

      return {
        content: [
          {
            type: "text",
            text: `✅ MCP SUCCESS: Email successfully delivered to ${to}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ MCP ERROR: Failed to send email. Details: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
  throw new Error("Tool not found");
});

// 4. Start the server on standard input/output
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("🟢 Local MCP Email Server running on stdio"); // Using stderr so it doesn't corrupt stdout IPC
});
