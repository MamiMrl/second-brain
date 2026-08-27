import React from "react";
import { Composer } from "./components/chat/Composer.jsx";
import { AnswerBody } from "./components/chat/AnswerBody.jsx";
import { SourceList } from "./components/chat/SourceList.jsx";
import { StatusLine } from "./components/chat/StatusLine.jsx";
import { useChatStatusStore } from "./stores/chatStatus.js";
import { useChatStream } from "./stores/useChatStream.js";

// The backend's Reference shape (query/generate-answer.ts) carries
// `citedText: string[]` (one entry per distinct cited span); the design
// system's AnswerBody/SourceList/CitationMarker components expect a single
// `cited` string — joined here rather than changing the imported components.
function toDisplayRefs(references) {
  return (references ?? []).map((r) => ({ number: r.number, title: r.title, ref: r.ref, cited: (r.citedText ?? []).join(" … ") }));
}

function AnswerMessage({ message }) {
  const refs = toDisplayRefs(message.references);
  return (
    <div style={{ maxWidth: "var(--content-max)", display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
      <AnswerBody text={message.text} refs={refs} />
      <SourceList refs={refs} />
    </div>
  );
}

// Ticket #19's walking skeleton: real conversation persistence + a real
// grounded, cited answer, wired to the existing design-system components —
// no new UI built here, just real data flowing through Composer/AnswerBody/
// SourceList. Streaming status (#20), conversation history (#22), and a
// full app shell (Sidebar/MessageThread) are later tickets.
export function App() {
  const [conversationId, setConversationId] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const abortRef = React.useRef(null);

  const statusStep = useChatStatusStore((state) => state.step);
  const clearStatus = useChatStatusStore((state) => state.clear);
  useChatStream(conversationId);

  React.useEffect(() => {
    fetch("/conversations", { method: "POST" })
      .then((res) => res.json())
      .then((body) => setConversationId(body.conversationId));
  }, []);

  async function submit() {
    const question = draft.trim();
    if (!question || busy || !conversationId) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setDraft("");
    setBusy(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
        signal: abortRef.current.signal,
      });
      const assistantMessage = await response.json();
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      if (err.name !== "AbortError") throw err;
    } finally {
      setBusy(false);
      abortRef.current = null;
      clearStatus(); // the SSE "answer" event also clears this, but a stopped/failed request never fires one
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--gutter)", display: "flex", flexDirection: "column", gap: "var(--message-gap)" }}>
        {messages.map((message, i) =>
          message.role === "user" ? (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "var(--content-max)", padding: "10px 14px", background: "var(--surface-bubble)", borderRadius: "var(--radius-bubble)" }}>
              {message.text}
            </div>
          ) : (
            <AnswerMessage key={i} message={message} />
          ),
        )}
      </div>
      <div style={{ padding: "var(--gutter)", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {busy ? (
          <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", width: "100%" }}>
            <StatusLine step={statusStep} />
          </div>
        ) : null}
        <Composer value={draft} onChange={setDraft} onSubmit={submit} onStop={stop} busy={busy} />
      </div>
    </div>
  );
}
