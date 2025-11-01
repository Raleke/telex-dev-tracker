import { getDb } from "../db.js";
import type { Issue } from "../types.js";

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
  addIssue: (channelId: string, title: string, severity?: string): string => {
    const db = getDb();
    const sev = severity || detectSeverity(title);
    const stmt = db.prepare(`INSERT INTO issues (description, severity, channel_id, status, detected_at) VALUES (?, ?, ?, 'open', ?)`);
    const info = stmt.run(title, sev, channelId, new Date().toISOString());
    db.close();
    return `Detected issue (severity: ${sev}). Logged to issue tracker.`;
  },

  showIssues: (channelId: string): string => {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM issues WHERE channel_id = ? ORDER BY id DESC`).all(channelId) as Issue[];
    db.close();
    if (!rows.length) return "No issues found.";

    // Group issues by severity
    const grouped: { critical: Issue[]; high: Issue[]; medium: Issue[]; low: Issue[] } = { critical: [], high: [], medium: [], low: [] };
    rows.forEach(issue => {
      const sev = issue.severity;
      if (sev in grouped) {
        grouped[sev as keyof typeof grouped].push(issue);
      } else {
        grouped.low.push(issue); // fallback
      }
    });

    const sections: string[] = [];
    for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
      const issues = grouped[severity];
      if (issues && issues.length > 0) {
        sections.push(`**${severity.toUpperCase()}** (${issues.length}):`);
        issues.forEach(issue => {
          sections.push(`  #${issue.id} • ${issue.description} [${issue.status}]`);
        });
      }
    }

    return sections.join("\n");
  },

  resolveIssue: (channelId: string, title: string): string => {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM issues WHERE channel_id = ? AND description LIKE ? AND status = 'open' ORDER BY id DESC`).get(channelId, `%${title}%`) as Issue | undefined;
    if (!row) {
      db.close();
      return `Issue not found for "${title}"`;
    }
    db.prepare(`UPDATE issues SET status = 'resolved' WHERE id = ?`).run(row.id);
    db.close();
    return `Resolved issue #${row.id} "${row.description}"`;
  },

  deleteResolvedIssues: (channelId: string): string => {
    const db = getDb();
    const info = db.prepare(`DELETE FROM issues WHERE channel_id = ? AND status = 'resolved'`).run(channelId);
    db.close();
    return `Deleted ${info.changes} resolved issues`;
  }
};
