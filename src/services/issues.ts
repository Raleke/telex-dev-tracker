import { getDb } from "../db.js";
import type { Issue } from "../types.js";
import { logger } from "../logger.js";

function detectSeverity(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("crash") || lower.includes("panic") || lower.includes("down") || lower.includes("fatal")) {
    return "critical";
  } else if (lower.includes("error") || lower.includes("exception") || lower.includes("fail")) {
    return "high";
  } else if (lower.includes("bug") || lower.includes("warning") || lower.includes("issue")) {
    return "medium";
  } else {
    return "low";
  }
}

export const IssuesService = {
  addIssue: async (channelId: string, title: string, severity?: string): Promise<string> => {
    try {
      const db = getDb();
      const sev = severity || detectSeverity(title);
      const stmt = db.prepare(`INSERT INTO issues (description, severity, channel_id, resolved, resolved_at, detected_at) VALUES (?, ?, ?, 0, null, ?)`);
      const info = stmt.run(title, sev, channelId, new Date().toISOString());
      db.close();
      logger.info(`Issue created: #${info.lastInsertRowid} "${title}" (severity: ${sev})`);
      return `Detected issue (severity: ${sev}). Logged to issue tracker.`;
    } catch (error) {
      logger.error(`Failed to add issue: ${error}`);
      throw new Error("Failed to log issue");
    }
  },

  showIssues: async (channelId: string): Promise<string> => {
    try {
      const db = getDb();
      const rows = db.prepare(`SELECT * FROM issues WHERE channel_id = ? ORDER BY id DESC`).all(channelId) as Issue[];
      db.close();
      if (!rows.length) return "No issues found.";

      // Separate unresolved and resolved
      const unresolved = rows.filter(issue => issue.resolved === 0);
      const resolved = rows.filter(issue => issue.resolved === 1);

      const sections: string[] = [];

      // Unresolved issues
      if (unresolved.length > 0) {
        sections.push("**🔴 UNRESOLVED ISSUES**");
        const groupedUnresolved: { critical: Issue[]; high: Issue[]; medium: Issue[]; low: Issue[] } = { critical: [], high: [], medium: [], low: [] };
        unresolved.forEach(issue => {
          const sev = issue.severity;
          if (sev in groupedUnresolved) {
            groupedUnresolved[sev as keyof typeof groupedUnresolved].push(issue);
          } else {
            groupedUnresolved.low.push(issue);
          }
        });
        for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
          const issues = groupedUnresolved[severity];
          if (issues && issues.length > 0) {
            sections.push(`  **${severity.toUpperCase()}** (${issues.length}):`);
            issues.forEach(issue => {
              sections.push(`    #${issue.id} • ${issue.description}`);
            });
          }
        }
      }

      // Resolved issues
      if (resolved.length > 0) {
        sections.push("\n**✅ RESOLVED ISSUES**");
        const groupedResolved: { critical: Issue[]; high: Issue[]; medium: Issue[]; low: Issue[] } = { critical: [], high: [], medium: [], low: [] };
        resolved.forEach(issue => {
          const sev = issue.severity;
          if (sev in groupedResolved) {
            groupedResolved[sev as keyof typeof groupedResolved].push(issue);
          } else {
            groupedResolved.low.push(issue);
          }
        });
        for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
          const issues = groupedResolved[severity];
          if (issues && issues.length > 0) {
            sections.push(`  **${severity.toUpperCase()}** (${issues.length}):`);
            issues.forEach(issue => {
              const resolvedDate = issue.resolved_at ? new Date(issue.resolved_at).toLocaleDateString() : 'Unknown';
              sections.push(`    #${issue.id} • ${issue.description} (Resolved: ${resolvedDate})`);
            });
          }
        }
      }

      return sections.join("\n");
    } catch (error) {
      logger.error(`Failed to show issues: ${error}`);
      throw new Error("Failed to retrieve issues");
    }
  },

  resolveIssue: async (channelId: string, title: string): Promise<string> => {
    try {
      const db = getDb();
      let row: Issue | undefined;
      if (/^\d+$/.test(title)) {
        // If title is numeric, treat as ID
        row = db.prepare(`SELECT * FROM issues WHERE channel_id = ? AND id = ? AND resolved = 0`).get(channelId, parseInt(title, 10)) as Issue | undefined;
      } else {
        // Otherwise, search by title
        row = db.prepare(`SELECT * FROM issues WHERE channel_id = ? AND description LIKE ? AND resolved = 0 ORDER BY id DESC`).get(channelId, `%${title}%`) as Issue | undefined;
      }
      if (!row) {
        db.close();
        return `Issue not found for "${title}"`;
      }
      const now = new Date().toISOString();
      const formattedDate = new Date(now).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const updatedDescription = `Resolved: ${formattedDate}\nDescription: ${row.description}`;
      db.prepare(`UPDATE issues SET resolved = 1, resolved_at = ?, description = ? WHERE id = ?`).run(now, updatedDescription, row.id);
      db.close();
      logger.info(`Issue resolved: #${row.id} "${row.description}"`);
      return `✅ Issue '${row.description}' has been resolved on ${formattedDate}.`;
    } catch (error) {
      logger.error(`Failed to resolve issue: ${error}`);
      throw new Error("Failed to resolve issue");
    }
  },

  deleteResolvedIssues: async (channelId: string): Promise<string> => {
    try {
      const db = getDb();
      const info = db.prepare(`DELETE FROM issues WHERE channel_id = ? AND resolved = 1`).run(channelId);
      db.close();
      logger.info(`Deleted ${info.changes} resolved issues`);
      return `Deleted ${info.changes} resolved issues`;
    } catch (error) {
      logger.error(`Failed to delete resolved issues: ${error}`);
      throw new Error("Failed to delete resolved issues");
    }
  }
};
