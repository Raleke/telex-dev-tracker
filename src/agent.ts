import { getDb } from "./db.js";
import type { Task } from "./types.js";

function nowIso() {
  return new Date().toISOString();
}

export const AgentLogic = {
  addTask: (title: string, labels?: string, channelId?: string, userId?: string) => {
    const db = getDb();
    const stmt = db.prepare(`INSERT INTO tasks (title, status, labels, channel_id, user_id, created_at, updated_at) VALUES (?, 'pending', ?, ?, ?, ?, ?)`);
    const info = stmt.run(title, labels || null, channelId || null, userId || null, nowIso(), nowIso());
    db.close();
    return ` Added task #${info.lastInsertRowid}: "${title}"`;
  },

  listTasks: (filter?: { status?: string; channelId?: string; userId?: string }) : string => {
    const db = getDb();
    let query = `SELECT * FROM tasks`;
    const params: any[] = [];
    const conditions: string[] = [];
    if (filter?.status) {
      conditions.push(`status = ?`);
      params.push(filter.status);
    }
    if (filter?.channelId) {
      conditions.push(`channel_id = ?`);
      params.push(filter.channelId);
    }
    if (filter?.userId) {
      conditions.push(`user_id = ?`);
      params.push(filter.userId);
    }
    if (conditions.length) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY id DESC`;
    const rows = db.prepare(query).all(...params);
    db.close();
    if (!rows.length) return "No tasks found.";
    const lines = rows.map((r: any) => `#${r.id} • ${r.title} [${r.status}]`);
    return lines.join("\n");
  },

  markTask: (idOrText: string, status: string, channelId?: string, userId?: string) : string => {
    const db = getDb();
    let query = `SELECT * FROM tasks WHERE`;
    const params: any[] = [];
    if (/^\d+$/.test(idOrText)) {
      query += ` id = ?`;
      params.push(parseInt(idOrText, 10));
    } else {
      query += ` title LIKE ?`;
      params.push(`%${idOrText}%`);
    }
    if (channelId) {
      query += ` AND channel_id = ?`;
      params.push(channelId);
    }
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    query += ` ORDER BY id DESC`;
    const row = db.prepare(query).get(...params) as Task | undefined;
    if (!row) {
      db.close();
      return ` Task not found for "${idOrText}"`;
    }
    db.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(status, nowIso(), row.id);
    db.close();
    return `Marked #${row.id} "${row.title}" as ${status}`;
  },

  deleteTask: (idOrText: string, channelId?: string, userId?: string) : string => {
    const db = getDb();
    let query = `SELECT * FROM tasks WHERE`;
    const params: any[] = [];
    if (/^\d+$/.test(idOrText)) {
      query += ` id = ?`;
      params.push(parseInt(idOrText, 10));
    } else {
      query += ` title LIKE ?`;
      params.push(`%${idOrText}%`);
    }
    if (channelId) {
      query += ` AND channel_id = ?`;
      params.push(channelId);
    }
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    query += ` ORDER BY id DESC`;
    const row = db.prepare(query).get(...params) as Task | undefined;
    if (!row) {
      db.close();
      return ` Task not found for "${idOrText}"`;
    }
    db.prepare(`DELETE FROM tasks WHERE id = ?`).run(row.id);
    db.close();
    return `Deleted task #${row.id} "${row.title}"`;
  },

  deleteCompletedTasks: (channelId?: string, userId?: string) : string => {
    const db = getDb();
    let query = `DELETE FROM tasks WHERE status = 'done'`;
    const params: any[] = [];
    if (channelId) {
      query += ` AND channel_id = ?`;
      params.push(channelId);
    }
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    const info = db.prepare(query).run(...params);
    db.close();
    return `Deleted ${info.changes} completed tasks`;
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
    let taskQuery = `SELECT status, COUNT(*) as count FROM tasks`;
    const params: any[] = [];
    if (channelId) {
      taskQuery += ` WHERE channel_id = ?`;
      params.push(channelId);
    }
    taskQuery += ` GROUP BY status`;
    const tasks = db.prepare(taskQuery).all(...params);
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
  },

  getProgressChart: (channelId?: string, userId?: string) => {
    const db = getDb();
    let query = `SELECT status, COUNT(*) as count FROM tasks`;
    const params: any[] = [];
    const conditions: string[] = [];
    if (channelId) {
      conditions.push(`channel_id = ?`);
      params.push(channelId);
    }
    if (userId) {
      conditions.push(`user_id = ?`);
      params.push(userId);
    }
    if (conditions.length) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` GROUP BY status`;
    const rows = db.prepare(query).all(...params);
    db.close();
    const chart: { [key: string]: number } = {};
    rows.forEach((r: any) => {
      chart[r.status] = r.count;
    });
    return chart;
  }
};
