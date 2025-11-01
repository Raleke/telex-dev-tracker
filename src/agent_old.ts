import { getDb } from "./db.js";

type Task = { id: number; title: string; status: string; labels?: string; created_at: string; updated_at: string; };

function nowIso() {
  return new Date().toISOString();
}

export const AgentLogic = {
  addTask: (title: string, labels?: string) => {
    const db = getDb();
    const stmt = db.prepare(`INSERT INTO tasks (title, status, labels, created_at, updated_at) VALUES (?, 'pending', ?, ?, ?)`);
    const info = stmt.run(title, labels || null, nowIso(), nowIso());
    db.close();
    return ` Added task #${info.lastInsertRowid}: "${title}"`;
  },

  listTasks: (filter?: { status?: string }) : string => {
    const db = getDb();
    let rows;
    if (filter?.status) {
      rows = db.prepare(`SELECT * FROM tasks WHERE status = ? ORDER BY id DESC`).all(filter.status);
    } else {
      rows = db.prepare(`SELECT * FROM tasks ORDER BY id DESC`).all();
    }
    db.close();
    if (!rows.length) return "No tasks found.";
    const lines = rows.map((r: any) => `#${r.id} • ${r.title} [${r.status}]`);
    return lines.join("\n");
  },

  markTask: (idOrText: string, status: string) : string => {
    const db = getDb();
    let row: any;
    if (/^\d+$/.test(idOrText)) {
      row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(parseInt(idOrText, 10));
    } else {
      row = db.prepare(`SELECT * FROM tasks WHERE title LIKE ? ORDER BY id DESC`).get(`%${idOrText}%`);
    }
    if (!row) {
      db.close();
      return ` Task not found for "${idOrText}"`;
    }
    db.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(status, nowIso(), row.id);
    db.close();
    return `Marked #${row.id} "${row.title}" as ${status}`;
  },

  detectIssue: (text: string) => {
    // naive detection by keywords — can be extended
    const keywords = ["error", "exception", "stacktrace", "crash", "failed", "bug", "panic"];
    const lowered = text.toLowerCase();
    const triggered = keywords.some(k => lowered.includes(k));
    if (!triggered) return null;

    // severity heuristics
    const severity = lowered.includes("panic") || lowered.includes("crash") ? "critical"
      : lowered.includes("error") || lowered.includes("exception") ? "high"
      : "medium";
    const db = getDb();
    const stmt = db.prepare(`INSERT INTO issues (description, severity, detected_at) VALUES (?, ?, ?)`);
    stmt.run(text, severity, new Date().toISOString());
    db.close();
    return ` Detected issue (severity: ${severity}). Logged to issue tracker.`;
  },

  generateDailySummary: (channelId?: string) => {
    const db = getDb();
    const tasks = db.prepare(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`).all();
    const issues = db.prepare(`SELECT severity, COUNT(*) as count FROM issues GROUP BY severity`).all();
    const now = new Date().toISOString();
    const taskLines = tasks.map((r: any) => `${r.count} ${r.status}`).join(", ") || "no tasks";
    const issueLines = issues.map((r: any) => `${r.count} ${r.severity}`).join(", ") || "no issues";
    const summary = `🗓️ Daily Summary (${now.split("T")[0]}): Tasks — ${taskLines}. Issues — ${issueLines}.`;
    db.prepare(`INSERT INTO summaries (channel_id, summary, created_at) VALUES (?, ?, ?)`).run(channelId || null, summary, now);
    db.close();
    return summary;
  },

  getSummaries: (limit = 10) => {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM summaries ORDER BY id DESC LIMIT ?`).all(limit);
    db.close();
    if (!rows.length) return "No summaries yet.";
    return rows.map((r: any) => `${r.created_at} • ${r.summary}`).join("\n\n");
  }
};