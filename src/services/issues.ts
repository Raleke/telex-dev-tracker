import { getDb } from "../db.js";
import type { Issue } from "../types.js";

function detectSeverity(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("crash") || lower.includes("fail") || lower.includes("error") || lower.includes("down")) {
    return "critical";
  } else if (lower.includes("bug") || lower.includes("exception") || lower.includes("failed")) {
    return "medium";
  } else {
    return "minor";
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
    const lines = rows.map((r) => `#${r.id} • ${r.description} [${r.severity}] [${r.status}]`);
    return lines.join("\n");
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
