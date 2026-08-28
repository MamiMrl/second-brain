// Ticket #25: launchd packaging for the always-on chat server (ticket #19).
// Pure plist-string generation, kept separate from the install/uninstall
// scripts so the XML shape itself is unit-testable without touching the
// filesystem or launchctl.

export const CHAT_SERVER_LABEL = "com.secondbrain.chatserver";

export interface ChatServerPlistOptions {
  nodePath: string;
  repoRoot: string;
  port: number;
  logDir: string;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// RunAtLoad + KeepAlive: auto-start at login, auto-restart on crash (#25's
// two acceptance criteria). Binding to 127.0.0.1 is enforced by the server
// itself (src/scripts/chat-server.ts), not by this plist.
export function generateChatServerPlist(options: ChatServerPlistOptions): string {
  const { nodePath, repoRoot, port, logDir } = options;
  const scriptPath = `${repoRoot}/src/scripts/chat-server.ts`;
  const stdout = `${logDir}/chat-server.out.log`;
  const stderr = `${logDir}/chat-server.err.log`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(CHAT_SERVER_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodePath)}</string>
    <string>--import</string>
    <string>tsx</string>
    <string>${xmlEscape(scriptPath)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(repoRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CHAT_SERVER_PORT</key>
    <string>${xmlEscape(String(port))}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(stdout)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(stderr)}</string>
</dict>
</plist>
`;
}
