import { IssuesService } from "../services/issues.js";
import { AgentLogic } from "../agent.js";
import { callMastraExternal } from "../mastraClient.js";

export async function handleTelexWebhook(input: string, metadata: any): Promise<{ output: string; actions?: any[] }> {
  const lower = String(input).trim().toLowerCase();
  const channelId = metadata?.channelId || process.env.DEFAULT_CHANNEL_ID;
  const userId = metadata?.userId;

  // Exact command matching for structured commands - no LLM until fallback

  // Issue commands
  if (/^issue\s+/i.test(input)) {
    const title = input.replace(/^issue\s+/i, "").trim();
    if (title) {
      const reply = await IssuesService.addIssue(channelId, title);
      return { output: reply };
    }
  }
  if (/^show\s+issues$/i.test(lower)) {
    const reply = await IssuesService.showIssues(channelId);
    return { output: reply };
  }
  if (/^resolve\s+issue\s+/i.test(input)) {
    const title = input.replace(/^resolve\s+issue\s+/i, "").trim();
    if (title) {
      const reply = await IssuesService.resolveIssue(channelId, title);
      return { output: reply };
    }
  }
  if (/^delete\s+all\s+resolved\s+issues$/i.test(lower)) {
    const reply = await IssuesService.deleteResolvedIssues(channelId);
    return { output: reply };
  }

  // Task commands
  if (/^add\s+task\s+/i.test(input)) {
    const title = input.replace(/^add\s+task\s+/i, "").trim();
    if (title) {
      const reply = AgentLogic.addTask(title, undefined, channelId, userId);
      return { output: reply };
    }
  }
  if (/^mark\s+/i.test(input)) {
    const asMatch = input.match(/mark\s+(.+)\s+as\s+(done|pending|in\s+progress)/i);
    if (asMatch) {
      const idOrText = asMatch[1]?.trim();
      const status = asMatch[2]?.trim().replace(/\s+/g, '_');
      if (idOrText && status) {
        const reply = AgentLogic.markTask(idOrText, status, channelId, userId);
        return { output: reply };
      }
    }
  }
  if (/^delete\s+/i.test(input)) {
    if (/^delete\s+all\s+completed(\s+tasks)?$/i.test(input)) {
      const reply = AgentLogic.deleteCompletedTasks(channelId, userId);
      return { output: reply };
    }
    const idOrText = input.replace(/^delete\s+/i, "").trim();
    if (idOrText && !/^all\s+resolved\s+issues$/i.test(idOrText)) {
      const reply = AgentLogic.deleteTask(idOrText, channelId, userId);
      return { output: reply };
    }
  }
  if (/^(show|list)\s+tasks$/i.test(lower)) {
    const reply = AgentLogic.listTasks({ channelId, userId });
    return { output: reply };
  }
  if (/^(summary|daily\s+summary|show\s+summary)$/i.test(lower)) {
    const reply = await AgentLogic.generateDailySummary(channelId);
    return { output: reply };
  }

  // If no exact command matched -> forward to external LLM for natural language processing
  const systemPrompt = process.env.SYSTEM_PROMPT || `You are the DevTrack Assistant, a professional AI agent that helps developers manage tasks, track issues, and summarize progress. Be context-aware, precise, and developer-friendly. Provide full, formal responses without one-word answers. Avoid hallucinations and stick to facts. If you don't understand a request, ask for clarification.`;
  const external = await callMastraExternal(input, systemPrompt, metadata);
  if (external && external.output) {
    return { output: external.output, actions: external.actions || [] };
  }

  // Fallback help text
  const help = `Hi — I'm the DevTracker assistant. Try: "add task <title>", "mark <task> as done", "delete <task>", "delete all completed", "issue <title>", "show issues", "resolve issue <title>", or "summary".`;
  return { output: help };
}
