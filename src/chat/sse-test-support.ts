export interface SseEvent {
  event: string;
  data: unknown;
}

// Shared by server.test.ts and server.integration.test.ts: reads
// `event:`/`data:` pairs off an SSE response's stream, skipping the leading
// `:ok` keep-alive comment server.ts sends to flush headers, and stopping as
// soon as `stopWhen` is satisfied by the events parsed so far (or the stream
// ends).
export async function readSseEvents(response: Response, stopWhen: (events: SseEvent[]) => boolean): Promise<SseEvent[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: SseEvent[] = [];
  let buffer = "";

  outer: while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (raw.startsWith(":")) continue;

      const eventLine = raw.match(/^event: (.+)$/m);
      const dataLine = raw.match(/^data: (.+)$/m);
      if (eventLine && dataLine) events.push({ event: eventLine[1], data: JSON.parse(dataLine[1]) });

      if (stopWhen(events)) break outer;
    }
  }

  await reader.cancel();
  return events;
}
