import { IssuesService } from "../services/issues.js";
import { AgentLogic } from "../agent.js";
import { callMastraExternal } from "../mastraClient.js";

export async function handleTelexWebhook(input: string, metadata: any): Promise<{ output: string; actions?: any[] }> {
  const lower = String(input).trim().toLowerCase();
  const channelId = metadata?.channelId || process.env.DEFAULT_CHANNEL_ID;
  const userId = metadata?.userId;

  // Issue commands - prioritized before task commands
  if (/^issue\s+/i.test(input)) {
    const title = input.replace(/^issue\s+/i, "").trim();
    if (title) {
      const reply = IssuesService.addIssue(channelId, title);
      return { output: reply };
    }
  }
  if (/^show\s+issues$/i.test(lower)) {
    const reply = IssuesService.showIssues(channelId);
    return { output: reply };
  }
  if (/^resolve\s+issue\s+/i.test(input)) {
    const title = input.replace(/^resolve\s+issue\s+/i, "").trim();
    if (title) {
      const reply = IssuesService.resolveIssue(channelId, title);
      return { output: reply };
    }
  }
  if (/^delete\s+all\s+resolved\s+issues$/i.test(lower)) {
    const reply = IssuesService.deleteResolvedIssues(channelId);
    return { output: reply };
  }

  // Task commands
  if (/^add\s+task/i.test(input)) {
    const title = input.replace(/^add\s+task/i, "").trim();
    const reply = AgentLogic.addTask(title, undefined, channelId, userId);
    return { output: reply };
  }
  if (/^add\s+/i.test(input) && !/^add\s+task/i.test(input)) {
    const title = input.replace(/^add\s+/i, "").trim();
    const reply = AgentLogic.addTask(title, undefined, channelId, userId);
    return { output: reply };
  }
  if (/^mark\s+/i.test(input)) {
    const asMatch = input.match(/mark\s+(.+)\s+as\s+(\w+)/i);
    if (asMatch) {
      const idOrText = asMatch[1]?.trim();
      const status = asMatch[2]?.trim();
      if (idOrText && status) {
        const reply = AgentLogic.markTask(idOrText, status, channelId, userId);
        return { output: reply };
      }
    }
  }
  if (/^delete\s+/i.test(input) && (/all\s+completed|all\s+done/i.test(input))) {
    const reply = AgentLogic.deleteCompletedTasks(channelId, userId);
    return { output: reply };
  }
  if (/^delete\s+/i.test(input) && !(/all\s+resolved\s+issues/i.test(input))) {
    const idOrText = input.replace(/^delete\s+/i, "").trim();
    if (idOrText) {
      const reply = AgentLogic.deleteTask(idOrText, channelId, userId);
      return { output: reply };
    }
  }
  if (/^(show|list)\s+tasks$/i.test(lower)) {
    const reply = AgentLogic.listTasks({ channelId, userId });
    return { output: reply };
  }
  if (/^(summary|daily\s+summary|show\s+summary)$/i.test(lower)) {
    const reply = AgentLogic.generateDailySummary(channelId);
    return { output: reply };
  }

  // If no local command matched -> optionally forward to external Mastra agent if configured
  const systemPrompt = process.env.SYSTEM_PROMPT;
  const external = await callMastraExternal(input, systemPrompt, metadata);
  if (external && external.output) {
    return { output: external.output, actions: external.actions || [] };
  }

  // Fallback help text
  const help = `Hi — I'm the DevTracker assistant. Try: "add task <title>", "mark <id|title> as done", "delete <id|title>", "delete all completed tasks", "show tasks", or "summary".`;
  return { output: help };
}
