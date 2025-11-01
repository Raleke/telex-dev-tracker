import { CronJob } from "cron";
import { generateDailySummary } from "./schedulerHelpers.js";
import { logger } from "./logger.js";

export function startScheduler() {
  const cronExpr = process.env.SUMMARY_CRON || "0 9 * * *";
  logger.info({ cronExpr }, "Starting scheduler for daily summaries");
  const job = new CronJob(cronExpr, async () => {
    try {
      await generateDailySummary();
    } catch (err: any) {
      logger.error({ err: err?.toString() }, "Scheduled summary failed");
    }
  }, null, true, "UTC");
  job.start();
  return job;
}