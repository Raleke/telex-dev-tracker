import express from "express";
import bodyParser from "body-parser";
import * as dotenv from "dotenv";
import { logger } from "./logger.js";
import { migrate } from "./db.js";
import { AgentLogic } from "./agent.js";
import { callMastraExternal } from "./mastraClient.js";
import { startScheduler } from "./scheduler.js";
import { generateDailySummary } from "./schedulerHelpers.js";

dotenv.config();

// Ensure DB
migrate();

const PORT = parseInt(process.env.PORT || "8080", 10);
const app = express();
app.use(bodyParser.json());

// Health
app.get("/", (_req, res) => res.send("telex-dev-tracker: healthy"));

// Mastra A2A endpoint that Telex workflows / A2A nodes call
app.post("/a2a/agent/devTrackerAgent", async (req, res) => {
  try {
    const { input = "", metadata = {} } = req.body as any;
    logger.info({ input, metadata }, "A2A request received");

    // 1) Try local logic to interpret commands
    const lower = String(input).trim().toLowerCase();

    // Command detection
    if (lower.startsWith("add task")) {
      const title = input.replace(/add task/i, "").trim();
      const reply = AgentLogic.addTask(title);
      return res.json({ output: reply });
    }
    if (lower.startsWith("mark")) {
      // e.g., "mark 3 as done" or "mark fix api as done"
      const asMatch = input.match(/mark\s+(.+)\s+as\s+(\w+)/i);
      if (asMatch) {
        const idOrText = asMatch[1]?.trim();
        const status = asMatch[2]?.trim();
        if (idOrText && status) {
          const reply = AgentLogic.markTask(idOrText, status);
          return res.json({ output: reply });
        }
      }
    }
    if (lower.includes("show tasks") || lower.includes("list tasks")) {
      const reply = AgentLogic.listTasks();
      return res.json({ output: reply });
    }
    if (lower.includes("summary") || lower.includes("daily summary") || lower.includes("show summary")) {
      const reply = AgentLogic.generateDailySummary(metadata?.channelId || process.env.DEFAULT_CHANNEL_ID);
      return res.json({ output: reply });
    }

    // If message looks like an issue report, detect and log
    const issueResp = AgentLogic.detectIssue(input);
    if (issueResp) return res.json({ output: issueResp });

    // If no local command matched -> optionally forward to external Mastra agent if configured
    const systemPrompt = process.env.SYSTEM_PROMPT;
    const external = await callMastraExternal(input, systemPrompt, metadata);
    if (external && external.output) {
      return res.json({ output: external.output, actions: external.actions || [] });
    }

    // Fallback help text
    const help = `Hi — I'm the DevTracker assistant. Try: "add task <title>", "mark <id|title> as done", "show tasks", or "summary".`;
    return res.json({ output: help });
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
    const text = incoming.text || incoming.body?.text || "";
    const metadata = { channelId: incoming.channelId || incoming.metadata?.channelId || incoming.from?.id };
    // reuse same logic by forwarding to the A2A handler shape
    // simple call:
    const proxyRes = await fetchLocalA2A(text, metadata);
    return res.json(proxyRes);
  } catch (err: any) {
    logger.error({ err: err?.toString() }, "Telex webhook error");
    return res.status(500).json({ error: "internal" });
  }
});

async function fetchLocalA2A(input: string, metadata: any) {
  // Reuse logic in the main a2a route without HTTP call
  const lower = String(input).trim().toLowerCase();
  if (lower.startsWith("add task")) {
    const title = input.replace(/add task/i, "").trim();
    return { output: AgentLogic.addTask(title) };
  }
  if (lower.startsWith("mark")) {
    const asMatch = input.match(/mark\s+(.+)\s+as\s+(\w+)/i);
    if (asMatch) {
      const idOrText = asMatch[1]?.trim();
      const status = asMatch[2]?.trim();
      if (idOrText && status) {
        return { output: AgentLogic.markTask(idOrText, status) };
      }
    }
  }
  if (lower.includes("show tasks") || lower.includes("list tasks")) {
    return { output: AgentLogic.listTasks() };
  }
  if (lower.includes("summary")) {
    return { output: AgentLogic.generateDailySummary(metadata?.channelId || process.env.DEFAULT_CHANNEL_ID) };
  }
  const issueResp = AgentLogic.detectIssue(input);
  if (issueResp) return { output: issueResp };

  // If external Mastra exists, call it
  const external = await callMastraExternal(input, process.env.SYSTEM_PROMPT, metadata);
  if (external && external.output) {
    return { output: external.output, actions: external.actions || [] };
  }

  return { output: `Try: "add task <title>", "mark <id|title> as done", "show tasks", or "summary".` };
}

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

// Start scheduler if enabled
startScheduler();

app.listen(PORT, () => {
  logger.info(`telex-dev-tracker listening on ${PORT}`);
});