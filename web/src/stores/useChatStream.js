import React from "react";
import { useChatStatusStore } from "./chatStatus.js";

// Ticket #20: subscribes to the conversation's SSE stream
// (GET /conversations/:id/stream) for as long as `conversationId` is set,
// feeding each "status" event into the chatStatus store and clearing it on
// the terminal "answer" event. The answer's actual content still comes back
// through the POST /messages response (App.jsx) — this only drives the
// status line.
export function useChatStream(conversationId) {
  const setStep = useChatStatusStore((state) => state.setStep);
  const clear = useChatStatusStore((state) => state.clear);

  React.useEffect(() => {
    if (!conversationId) return;

    const source = new EventSource(`/conversations/${conversationId}/stream`);
    source.addEventListener("status", (event) => setStep(JSON.parse(event.data).step));
    source.addEventListener("answer", () => clear());

    return () => {
      source.close();
      clear();
    };
  }, [conversationId, setStep, clear]);
}
