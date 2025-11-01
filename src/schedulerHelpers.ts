import { AgentLogic } from "./agent.js";
import { logger } from "./logger.js";
import { postToTelex } from "./telexClient.js";

export async function generateDailySummary() {
  const channelId = process.env.DEFAULT_CHANNEL_ID;
  const summary = AgentLogic.generateDailySummary(channelId);
  logger.info({ summary }, "Generated daily summary");

  const outbound = process.env.TELEX_OUTBOUND_URL;
  if (outbound) {
    try {
      const payload = {
        channel: channelId || "global",
        type: "message",
        body: { text: summary }
      };
      await postToTelex(outbound, payload);
      logger.info("Posted daily summary to TELEX_OUTBOUND_URL");
    } catch (err: any) {
      logger.error({ err: err?.toString() }, "Failed to post daily summary to Telex");
    }
  }
  return summary;
}