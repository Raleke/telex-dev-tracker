import express from "express";
import bodyParser from "body-parser";
import * as dotenv from "dotenv";
import { logger } from "./logger.js";
import { migrate } from "./db.js";
import { AgentLogic } from "./agent.js";
import { IssuesService } from "./services/issues.js";
import { callMastraExternal } from "./mastraClient.js";
import { handleTelexWebhook } from "./handlers/telex.js";
import { startScheduler } from "./scheduler.js";
import { generateDailySummary } from "./schedulerHelpers.js";

dotenv.config();

// Ensure DB
migrate();

const PORT = parseInt(process.env.PORT || "8080", 10);
const app = express();
app.use(bodyParser.json());

// Root endpoint with help message
app.get("/", (_req, res) => res.json({ output: `Hi — I'm the DevTracker assistant. Try: "add task <title>", "mark <id|title> as done", "delete <id|title>", "delete all completed tasks", "show tasks", or "summary".` }));

// Mastra A2A endpoint that Telex workflows / A2A nodes call
app.post("/a2a/agent/devTrackerAgent", async (req, res) => {
  try {
    const { input = "", metadata = {} } = req.body as any;
    logger.info({ input, metadata }, "A2A request received");

    const result = await handleTelexWebhook(input, metadata);
    return res.json(result);
  } catch (err: any) {
    logger.error({ err: err?.toString() }, "A2A handler error");
    return res.status(500).json({ output: "Internal server error" });
  }
});

// Endpoint Telex might call for raw webhooks (mirrors A2A behavior)
app.post("/webhook/telex", async (req, res) => {
  // For compatibility, handle the incoming message shape Telex uses
  try {
    const incoming = req.body;
    const text = incoming.input || incoming.text || incoming.body?.text || "";
    const metadata = incoming.metadata || { channelId: incoming.channelId || incoming.from?.id, userId: incoming.userId };
    const result = await handleTelexWebhook(text, metadata);
    return res.json(result);
  } catch (err: any) {
    logger.error({ err: err?.toString() }, "Telex webhook error");
    return res.status(500).json({ error: "internal" });
  }
});



// Admin endpoints
app.get("/admin/summaries", (_req, res) => {
  res.send(AgentLogic.getSummaries(20));
});

app.post("/admin/summary/run", async (req, res) => {
  try {
    const summary = await generateDailySummary();
    res.json({ output: summary });
  } catch (err: any) {
    res.status(500).json({ error: err?.toString() });
  }
});

// Progress chart endpoint
app.get("/progress", (req, res) => {
  try {
    const channelId = req.query.channelId as string;
    const userId = req.query.userId as string;
    const chart = AgentLogic.getProgressChart(channelId, userId);
    res.json(chart);
  } catch (err: any) {
    res.status(500).json({ error: err?.toString() });
  }
});

// Start scheduler if enabled
startScheduler();

app.listen(PORT, () => {
  logger.info(`telex-dev-tracker listening on ${PORT}`);
});
