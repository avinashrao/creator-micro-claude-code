import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath, pathToFileURL} from "node:url";

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "helper");
const library = path.join(os.homedir(), "Library");
const target = path.join(library, "Application Support", "Claude Code Keypad Lights");
const label = "local.creator-micro.claude-code-lights";
const plist = path.join(library, "LaunchAgents", label + ".plist");
const log = path.join(library, "Logs", label + ".log");

async function main() {
  const args = process.argv.slice(2);
  const check = args[0] === "--check";
  if (check) args.shift();
  if (args.length > 1) throw new Error("Usage: node setup.mjs [--check] [device-serial]");
  if (process.platform !== "darwin" || Number(process.versions.node.split(".")[0]) < 20) {
    throw new Error("Use macOS and Node.js 20 or later.");
  }
  if (!check && (fs.existsSync(plist) || fs.existsSync(target))) {
    throw new Error("A Claude keypad helper is already installed. Use --check to verify the layer.");
  }

  const parent = check ? os.tmpdir() : path.dirname(target);
  fs.mkdirSync(parent, {recursive:true});
  const temp = fs.mkdtempSync(path.join(parent, ".claude-keypad-"));
  let moved = false;
  let createdPlist = false;
  try {
    const stage = path.join(temp, "helper");
    fs.cpSync(source, stage, {recursive:true});
    const kit = path.join(stage, "vendor", "creator-micro-kit");
    const build = path.join(kit, "build");
    fs.mkdirSync(build, {recursive:true});
    console.log("Building the keypad bridge on this Mac…");
    execFileSync("/usr/bin/xcrun", ["swiftc", "-O", path.join(kit, "native", "cm-bridge.swift"),
      "-o", path.join(build, "cm-bridge")], {stdio:"inherit"});
    const {CreatorMicro, open} = await import(pathToFileURL(path.join(kit, "src", "index.js")).href);
    const devices = new Map();
    for (const d of await CreatorMicro.listDevices()) {
      if (d.hasVendorCollection && [0x8298, 0x8297].includes(d.productId) && d.serialNumber) {
        devices.set(d.serialNumber, d);
      }
    }
    if (!devices.size) throw new Error("No Creator Micro 2 found. Connect it by USB data cable, wake it, then retry.");
    const device = args.length ? devices.get(args[0]) : devices.size === 1 ? [...devices.values()][0] : null;
    if (!device) throw new Error("Choose a connected keypad by adding its serial to the command: " + [...devices.keys()].join(", "));
    const keypad = await open({serial:device.serialNumber, productId:device.productId});
    try {
      const config = JSON.parse(await keypad.readFile("keymap.json"));
      const sessionKeys = Array.from({length:6}, (_,i) => "KV_OAI_AG" + (14+i));
      const matches = config.profiles.flatMap(profile => profile.layers.filter(layer =>
        sessionKeys.every((code,i) => layer.layout.keymap?.flat()[i] === code)));
      if (!matches.length) throw new Error("Import Claude Code-layer.json in Input and save it to the device first.");
      console.log("Found the six Claude session keys on layer “" + matches[0].name + "”.");
    } finally {
      await keypad.close();
    }
    if (check) return;

    fs.mkdirSync(path.dirname(plist), {recursive:true});
    fs.mkdirSync(path.dirname(log), {recursive:true});
    const definition = {Label:label, ProgramArguments:[process.execPath, path.join(target,"desktop-layer.mjs"),
      device.serialNumber, String(device.productId)], RunAtLoad:true, KeepAlive:true, ProcessType:"Background",
      ThrottleInterval:10, StandardOutPath:log, StandardErrorPath:log};
    const draft = path.join(temp, "agent.plist");
    fs.writeFileSync(draft, JSON.stringify(definition), {mode:0o600});
    execFileSync("/usr/bin/plutil", ["-convert","xml1",draft]);
    if (fs.existsSync(target)) throw new Error("Another installation created the helper folder. Retry with --check.");
    fs.renameSync(stage, target);
    moved = true;
    fs.copyFileSync(draft, plist, fs.constants.COPYFILE_EXCL);
    createdPlist = true;
    execFileSync("/bin/launchctl", ["bootstrap","gui/" + process.getuid(),plist], {stdio:"inherit"});
    console.log("Installed. Switch to the Claude Code layer and tap a lit key. The helper starts at login.");
    console.log("Helper log: " + log);
  } catch (error) {
    if (createdPlist) fs.unlinkSync(plist);
    if (moved) fs.rmSync(target, {recursive:true});
    throw error;
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
