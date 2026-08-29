import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Composer } from "./components/chat/Composer.jsx";
import { AnswerBody } from "./components/chat/AnswerBody.jsx";
import { SourceList } from "./components/chat/SourceList.jsx";
import { StatusLine } from "./components/chat/StatusLine.jsx";
import { Sidebar } from "./components/chat/Sidebar.jsx";
import { useChatStatusStore } from "./stores/chatStatus.js";
import { useChatStream } from "./stores/useChatStream.js";
import { useConversationList, useConversation } from "./hooks/useConversations.js";
import { useDraft } from "./hooks/useDraft.js";

const LAST_CONVERSATION_KEY = "sb:lastConversationId";

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

// Ticket #19's walking skeleton laid down conversation persistence + a real
// grounded, cited answer. Ticket #22 adds: a sidebar listing past
// conversations (GET /conversations), restoring a selected one's messages
// (GET /conversations/:id) instead of always starting blank, and a
// client-persisted composer draft that survives a reload or tab close.
// Conversations are created lazily — on first send, not on page load — so
// reloading the app never litters the sidebar with empty threads.
export function App() {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = React.useState(() => localStorage.getItem(LAST_CONVERSATION_KEY));
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft, clearDraft] = useDraft(conversationId);
  const [busy, setBusy] = React.useState(false);
  const abortRef = React.useRef(null);

  const statusStep = useChatStatusStore((state) => state.step);
  const clearStatus = useChatStatusStore((state) => state.clear);
  useChatStream(conversationId);

  const conversationList = useConversationList();
  const activeConversation = useConversation(conversationId);
  // Tracks which conversation's server data has already been applied to
  // `messages`, so a background refetch (or the fetch triggered by a
  // conversation this tab itself just created mid-submit) never clobbers
  // messages appended optimistically during an in-flight send.
  const syncedConversationIdRef = React.useRef(null);

  // Restores the selected conversation's transcript once per switch — on
  // initial load (resuming the last active thread) and on switching threads
  // via the sidebar.
  React.useEffect(() => {
    if (activeConversation.data && syncedConversationIdRef.current !== conversationId) {
      setMessages(activeConversation.data.messages);
      syncedConversationIdRef.current = conversationId;
    }
  }, [activeConversation.data, conversationId]);

  function selectThread(id) {
    setConversationId(id);
    localStorage.setItem(LAST_CONVERSATION_KEY, id);
  }

  function newThread() {
    setConversationId(null);
    localStorage.removeItem(LAST_CONVERSATION_KEY);
    setMessages([]);
    syncedConversationIdRef.current = null; // otherwise reselecting the same thread later is a no-op and its history never re-syncs
  }

  async function submit() {
    const question = draft.trim();
    if (!question || busy) return;

    let activeId = conversationId;
    if (!activeId) {
      const response = await fetch("/conversations", { method: "POST" });
      const body = await response.json();
      activeId = body.conversationId;
      syncedConversationIdRef.current = activeId; // freshly created here — nothing to fetch-and-merge
      setConversationId(activeId);
      localStorage.setItem(LAST_CONVERSATION_KEY, activeId);
    }

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    clearDraft();
    setBusy(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
        signal: abortRef.current.signal,
      });
      const assistantMessage = await response.json();
      setMessages((prev) => [...prev, assistantMessage]);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
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
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar
        threads={conversationList.data ?? []}
        activeConversationId={conversationId}
        onSelectThread={selectThread}
        onNewThread={newThread}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--gutter)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: "100%", maxWidth: "var(--content-max)", display: "flex", flexDirection: "column", gap: "var(--message-gap)" }}>
            {messages.map((message, i) =>
              message.role === "user" ? (
                <div
                  key={i}
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "75%",
                    padding: "12px 18px",
                    fontSize: "var(--text-base)",
                    lineHeight: "var(--leading-bubble)",
                    background: "var(--surface-bubble)",
                    borderRadius: "var(--radius-bubble)",
                  }}
                >
                  {message.text}
                </div>
              ) : (
                <AnswerMessage key={i} message={message} />
              ),
            )}
          </div>
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
    </div>
  );
}
