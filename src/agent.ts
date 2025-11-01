import { getDb } from "./db.js";
import type { Task } from "./types.js";

function nowIso() {
  return new Date().toISOString();
}

// Simple in-memory cache with TTL
const cache: { [key: string]: { data: string; expires: number } } = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): string | null {
  const entry = cache[key];
  if (entry && Date.now() < entry.expires) {
    return entry.data;
  }
  delete cache[key];
  return null;
}

function setCached(key: string, data: string) {
  cache[key] = { data, expires: Date.now() + CACHE_TTL };
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
    const cacheKey = `tasks_${filter?.channelId || 'global'}_${filter?.userId || 'all'}_${filter?.status || 'all'}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

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
    if (!rows.length) {
      const result = "No tasks found.";
      setCached(cacheKey, result);
      return result;
    }
    const lines = rows.map((r: any) => `#${r.id} • ${r.title} [${r.status}]`);
    const result = lines.join("\n");
    setCached(cacheKey, result);
    return result;
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
    const date = now.split("T")[0];

    // Structured summary
    let summary = `🗓️ **Daily Developer Summary** (${date})\n\n`;

    // Tasks section
    summary += `**📋 Tasks Overview:**\n`;
    if (tasks.length > 0) {
      tasks.forEach((r: any) => {
        summary += `  • ${r.count} ${r.status}\n`;
      });
    } else {
      summary += `  • No tasks recorded\n`;
    }

    // Issues section
    summary += `\n**🚨 Issues by Severity:**\n`;
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    let hasIssues = false;
    severityOrder.forEach(sev => {
      const issue = (issues as any[]).find((i: any) => i.severity === sev);
      if (issue) {
        summary += `  • ${issue.count} ${sev}\n`;
        hasIssues = true;
      }
    });
    if (!hasIssues) {
      summary += `  • No issues recorded\n`;
    }

    // Recent activity
    const recentTasks = db.prepare(`SELECT title, status FROM tasks WHERE created_at >= ? ORDER BY created_at DESC LIMIT 5`).all(`${date}T00:00:00.000Z`);
    if (recentTasks.length > 0) {
      summary += `\n**🔄 Recent Tasks:**\n`;
      recentTasks.forEach((t: any) => {
        summary += `  • "${t.title}" [${t.status}]\n`;
      });
    }

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
  }
};
