import React from "react";

// Maps answerQuery()'s PipelineStep ids (src/query/answer-query.ts) to the
// copy shown while a question is in flight. Falls back to the raw id for
// any step this component doesn't know about yet, so a backend addition
// degrades to plain text instead of rendering nothing.
const STEP_LABEL = {
  "resolving-filters": "Resolving filters…",
  "searching-documents": "Searching your documents…",
  "generating-answer": "Generating answer…",
  "checking-groundedness": "Checking groundedness…",
};

// Ticket #20: live status while a question runs, replaced as each SSE
// "status" event arrives and cleared once the final answer lands — see the
// chatStatus store (chatStatus.js) this reads from.
export function StatusLine({ step }) {
  if (!step) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-8)",
        fontSize: "var(--text-caption)",
        color: "var(--text-faint)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span style={{ animation: "sb-pulse var(--pulse-text) ease-in-out infinite" }}>{STEP_LABEL[step] ?? step}</span>
    </div>
  );
}
