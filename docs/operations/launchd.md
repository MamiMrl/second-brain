# Running the chat server as a launchd service

Ticket #25. Packages the always-on chat server (ticket #19, `npm run chat-server`)
as a macOS launchd user agent: it starts automatically at login (`RunAtLoad`)
and restarts automatically if it crashes (`KeepAlive`).

## Install

```
npm run launchd:install
```

This writes `~/Library/LaunchAgents/com.secondbrain.chatserver.plist` (pointing
at this checkout's absolute path and the current `node` binary), then loads it
with `launchctl bootstrap`. Re-run it any time after pulling changes that
affect the service's startup command or port — it unloads and reloads the
definition so edits take effect.

Logs go to `~/Library/Logs/second-brain/chat-server.{out,err}.log`.

## Uninstall

```
npm run launchd:uninstall
```

Stops the service, unloads it from launchd, and deletes the plist.

## Verifying it's actually running

```
launchctl print gui/$(id -u)/com.secondbrain.chatserver
```

## Verifying it restarts after a crash

```
launchctl kill KILL gui/$(id -u)/com.secondbrain.chatserver
sleep 2
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4319/
```

A `200`/`404` (anything but connection-refused) means launchd already
restarted the process.

## Verifying it's only reachable from this machine

The server binds explicitly to `127.0.0.1` (`src/scripts/chat-server.ts`), not
`0.0.0.0`, so it should be unreachable from any other address on the LAN.
From another machine on the same network:

```
curl --connect-timeout 3 http://<this-machine's-LAN-IP>:4319/
```

This should time out / fail to connect. From this machine, find its LAN IP
with `ipconfig getifaddr en0` (or the relevant interface) if you want to try
connecting from itself over that address rather than `127.0.0.1` — that
connection should also fail, since the socket is only bound to the loopback
address, not to the LAN-facing interface.
