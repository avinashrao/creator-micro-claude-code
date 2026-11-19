import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { open, Effect } from "./vendor/creator-micro-kit/src/index.js";
import { desktopSlots, markViewed } from "./desktop-sessions.mjs";

const run = promisify(execFile);
const serial = process.argv[2];
if (!serial) throw new Error("Creator Micro serial required");
const colors = { working:"#006FFF", waiting:"#FFAC28", complete:"#00BE62", error:"#FF344C", idle:"#FFFFFF", empty:"#000000" };
const firstSlot = 14;
let lastMessage = "";
function report(s) {
  if (s !== lastMessage) console.log(new Date().toISOString(), s);
  lastMessage = s;
}

let lastPress = null;
async function selectSession(slot, displayed, now) {
  const double = lastPress?.slot === slot && now-lastPress.at < 350;
  const session = double ? lastPress.session : displayed[slot];
  if (!session) return;
  lastPress = {slot, session, at:now};
  // This is the exact session URI used by Claude Desktop's own Spotlight integration.
  const args = double ? [] : ["-g"];
  await run("/usr/bin/open", [...args, "-b", "com.anthropic.claudefordesktop", "claude://code/continue?session=" + session.id]);
  markViewed(session.id);
  report("Selected Claude Desktop session " + session.id + " with key " + (slot+1) + " [" + session.state + "]" + (double ? " (foreground)" : ""));
}

for (;;) {
  let keypad;
  try {
    keypad = await open({serial, productId:Number(process.argv[3])});
    let displayed;
    let lastFrame = "";
    lastPress = null;
    keypad.on("error", e => report(e.message));
    async function refresh() {
      const status = await keypad.getStatus();
      const sessions = desktopSlots();
      const signature = JSON.stringify([status.profile_index, status.layer_index, sessions]);
      if (signature === lastFrame) return;

      // Thread colors follow AG keycodes in firmware, even when layers are reordered.
      // Only publish Claude's six IDs. A layer change repaints them after a switch.
      const frame = Array.from({length:6}, (_,i) => sessions[i]?.state || "empty");
      await keypad.setThreadColors(frame.map((state,i) => ({
        id:firstSlot+i, color:colors[state], brightness:state==="empty"?0:state==="idle"?0.45:1,
        effect:state==="working"?Effect.breath:state==="empty"?Effect.off:Effect.solid,
        speed:state==="working"?0.7:0, syncKeys:false, syncAmbient:false
      })));
      displayed = sessions;
      lastFrame = signature;
      report("Claude agent lights acknowledged on device layer " + status.layer_index + ": " +
        frame.map((state,i) => (i+1) + "=" + (sessions[i]?.id || "-") + "/" + state).join(" "));
    }
    const firstFrame = refresh();
    keypad.on("key", e => {
      if (!e.pressed || !/^AG(1[4-9])$/.test(e.key)) return;
      const slot = Number(e.key.slice(2))-firstSlot;
      const now = Date.now();
      // Use only an acknowledged LED assignment, including on the first press after reconnect.
      const navigation = displayed ? selectSession(slot, displayed, now) :
        firstFrame.then(() => selectSession(slot, displayed, now));
      navigation.catch(e => report("Session navigation failed: " + e.message));
    });
    await firstFrame;
    for (;;) {
      await sleep(2200);
      await refresh();
    }
  } catch (error) { report("Waiting for keypad: "+error.message); }
  finally { await keypad?.close().catch(()=>{}); }
  await sleep(2500);
}
