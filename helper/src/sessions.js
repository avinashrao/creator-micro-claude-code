import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SESSIONS = path.join(os.homedir(), ".claude", "sessions");

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** sessionId → pid record, for every session with a live process. */
export function liveSessions() {
  let entries;
  try { entries = fs.readdirSync(SESSIONS); } catch { return new Map(); }
  const live = new Map();
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    let record;
    try { record = JSON.parse(fs.readFileSync(path.join(SESSIONS, entry), "utf8")); } catch { continue; }
    if (record.pid && record.sessionId && isAlive(record.pid)) live.set(record.sessionId, record);
  }
  return live;
}
