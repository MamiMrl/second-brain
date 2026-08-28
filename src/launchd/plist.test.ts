import { describe, expect, it } from "vitest";
import { CHAT_SERVER_LABEL, generateChatServerPlist } from "./plist.js";

const baseOptions = {
  nodePath: "/Users/neu/.nvm/versions/node/v22.13.0/bin/node",
  repoRoot: "/Users/neu/Code/active/second-brain",
  port: 4319,
  logDir: "/Users/neu/Library/Logs/second-brain",
};

describe("generateChatServerPlist", () => {
  it("labels the job for launchctl lookup", () => {
    const plist = generateChatServerPlist(baseOptions);
    expect(plist).toContain(`<string>${CHAT_SERVER_LABEL}</string>`);
  });

  it("runs the chat-server script via the given node binary and tsx", () => {
    const plist = generateChatServerPlist(baseOptions);
    expect(plist).toContain(`<string>${baseOptions.nodePath}</string>`);
    expect(plist).toContain("<string>--import</string>");
    expect(plist).toContain("<string>tsx</string>");
    expect(plist).toContain(`<string>${baseOptions.repoRoot}/src/scripts/chat-server.ts</string>`);
  });

  it("sets the working directory so dotenv resolves .env from the repo root", () => {
    const plist = generateChatServerPlist(baseOptions);
    expect(plist).toContain(`<key>WorkingDirectory</key>\n  <string>${baseOptions.repoRoot}</string>`);
  });

  it("passes the port through as an environment variable", () => {
    const plist = generateChatServerPlist({ ...baseOptions, port: 5555 });
    expect(plist).toContain("<key>CHAT_SERVER_PORT</key>\n    <string>5555</string>");
  });

  it("enables auto-start at login and auto-restart on crash", () => {
    const plist = generateChatServerPlist(baseOptions);
    expect(plist).toContain("<key>RunAtLoad</key>\n  <true/>");
    expect(plist).toContain("<key>KeepAlive</key>\n  <true/>");
  });

  it("points stdout/stderr at files under the given log directory", () => {
    const plist = generateChatServerPlist(baseOptions);
    expect(plist).toContain(`<string>${baseOptions.logDir}/chat-server.out.log</string>`);
    expect(plist).toContain(`<string>${baseOptions.logDir}/chat-server.err.log</string>`);
  });

  it("XML-escapes paths containing special characters", () => {
    const plist = generateChatServerPlist({ ...baseOptions, repoRoot: "/Users/a&b/<repo>" });
    expect(plist).toContain("/Users/a&amp;b/&lt;repo&gt;");
    expect(plist).not.toContain("/Users/a&b/<repo>/src");
  });

  it("produces well-formed, parseable plist XML", () => {
    const plist = generateChatServerPlist(baseOptions);
    expect(plist.trimStart()).toMatch(/^<\?xml/);
    expect(plist).toContain("<!DOCTYPE plist");
    expect(plist.match(/<dict>/g)?.length).toBe(2); // outer + EnvironmentVariables
    expect(plist.match(/<\/dict>/g)?.length).toBe(2);
  });
});
