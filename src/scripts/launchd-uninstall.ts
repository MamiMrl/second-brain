import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { CHAT_SERVER_LABEL } from "../launchd/plist.js";

// Ticket #25: reverses launchd-install.ts — stops the service, unloads it
// from launchd, and removes the plist so it won't come back at next login.
const PLIST_PATH = path.join(os.homedir(), "Library/LaunchAgents", `${CHAT_SERVER_LABEL}.plist`);

function main() {
  const uid = process.getuid?.();
  if (uid === undefined) {
    throw new Error("launchd uninstall requires a POSIX uid (macOS only)");
  }
  const target = `gui/${uid}/${CHAT_SERVER_LABEL}`;

  try {
    execFileSync("launchctl", ["bootout", target], { stdio: "inherit" });
  } catch {
    console.log(`${CHAT_SERVER_LABEL} was not loaded.`);
  }

  if (fs.existsSync(PLIST_PATH)) {
    fs.unlinkSync(PLIST_PATH);
    console.log(`Removed ${PLIST_PATH}`);
  }
}

main();
