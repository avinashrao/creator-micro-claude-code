import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { liveSessions } from "./src/sessions.js";

const desktop = path.join(os.homedir(), "Library/Application Support/Claude");
const idPattern = /^local_[a-f\d-]{36}$/i;
const cache = new Map();
const visited = new Map();
export function markViewed(id) { visited.set(id, Date.now()); }

function metadata(filename) {
  const stat = fs.statSync(filename);
  const old = cache.get(filename);
  if (old?.mtime === stat.mtimeMs && old.size === stat.size) return old.session;
  const d = JSON.parse(fs.readFileSync(filename, "utf8"));
  const session = !d.isArchived && idPattern.test(d.sessionId) ? {
    id: d.sessionId, cli: d.cliSessionId, activity: d.lastActivityAt || d.createdAt || 0,
    focused: d.lastFocusedAt || 0, edge: d.lastTurnEdgeAt || 0,
    errorAt: d.error ? (d.errorAt || 0) : 0, needsInput: Boolean(d.interruptedAwaitingPerson),
    hasReply: Boolean(d.lastAssistantUuid)
  } : null;
  cache.set(filename, {mtime: stat.mtimeMs, size: stat.size, session});
  return session;
}

function statusOf(s, process) {
  const state = String(process?.status || "").toLowerCase();
  if (s.needsInput || /needs.?input|waiting|blocked|permission|attention/.test(state)) return "waiting";
  if (s.errorAt && s.errorAt >= s.edge && !["working", "busy", "running"].includes(state)) return "error";
  if (["busy", "running", "working", "thinking"].includes(state)) return "working";
  if (s.hasReply && s.edge > Math.max(s.focused, visited.get(s.id) || 0)) return "complete";
  return "idle";
}

export function desktopSlots() {
  const config = JSON.parse(fs.readFileSync(path.join(desktop, "config.json"), "utf8"));
  const account = config.lastKnownAccountUuid;
  if (!/^[a-f\d-]{36}$/i.test(account || "")) throw new Error("No active Claude Desktop account");
  const root = path.join(desktop, "claude-code-sessions", account);
  const groups = fs.readdirSync(root, {withFileTypes:true}).filter(d => d.isDirectory() && /^[a-f\d-]{36}$/i.test(d.name));
  const sessions = [];
  for (const group of groups) {
    const dir = path.join(root, group.name);
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json") || !idPattern.test(file.slice(0,-5))) continue;
      let s;
      try { s = metadata(path.join(dir,file)); } catch { continue; }
      if (s) sessions.push({...s, group:group.name});
    }
  }
  // The user's current organization is the one containing the most recently focused session.
  const activeGroup = sessions.reduce((best,s) => !best || s.focused > best.focused ? s : best, null)?.group;
  const live = liveSessions();
  return sessions.filter(s => s.group === activeGroup)
    .sort((a,b) => b.activity-a.activity || a.id.localeCompare(b.id)).slice(0,6)
    .map(s => ({id:s.id, state:statusOf(s,live.get(s.cli))}));
}
