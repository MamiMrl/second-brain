import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CHAT_SERVER_LABEL, generateChatServerPlist } from "../launchd/plist.js";

// Ticket #25: installs the always-on chat server (ticket #19) as a launchd
// user agent — RunAtLoad (auto-start at login) + KeepAlive (auto-restart on
// crash). Idempotent: bootstrapping an already-loaded label is harmless
// (launchctl reports it, this script ignores that and moves on).
const PORT = Number(process.env.CHAT_SERVER_PORT ?? 4319);
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const PLIST_PATH = path.join(os.homedir(), "Library/LaunchAgents", `${CHAT_SERVER_LABEL}.plist`);
const LOG_DIR = path.join(os.homedir(), "Library/Logs/second-brain");

function main() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(PLIST_PATH), { recursive: true });

  const plist = generateChatServerPlist({
    nodePath: process.execPath,
    repoRoot: REPO_ROOT,
    port: PORT,
    logDir: LOG_DIR,
  });
  fs.writeFileSync(PLIST_PATH, plist, "utf8");
  console.log(`Wrote ${PLIST_PATH}`);

  const uid = process.getuid?.();
  if (uid === undefined) {
    throw new Error("launchd install requires a POSIX uid (macOS only)");
  }
  const target = `gui/${uid}/${CHAT_SERVER_LABEL}`;

  // bootout first so re-running this script after an edit picks up the
  // change, rather than silently keeping the previously loaded definition.
  try {
    execFileSync("launchctl", ["bootout", target], { stdio: "ignore" });
  } catch {
    // not currently loaded — fine, this is the common case on first install
  }
  execFileSync("launchctl", ["bootstrap", `gui/${uid}`, PLIST_PATH], { stdio: "inherit" });
  execFileSync("launchctl", ["enable", target], { stdio: "inherit" });

  console.log(`Loaded ${CHAT_SERVER_LABEL}. It will now start at login and restart if it crashes.`);
  console.log(`Logs: ${LOG_DIR}/chat-server.out.log / chat-server.err.log`);
}

main();
