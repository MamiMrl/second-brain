import React from "react";
import { CitationMarker } from "./CitationMarker.jsx";

// Splits "text[1][2] more" into runs, rendering each [n] as a marker.
function parse(text) {
  const out = [];
  const re = /((?:\[\d+\])+)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    out.push({ text: text.slice(last, m.index), marks: m[1].match(/\d+/g).map(Number) });
    last = m.index + m[1].length;
  }
  if (last < text.length || out.length === 0) out.push({ text: text.slice(last), marks: [] });
  return out;
}

export function AnswerBody({ text, refs = [], streaming }) {
  return (
    <div style={{ lineHeight: "var(--leading-answer)", color: "var(--text-primary)" }}>
      {parse(text).map((seg, i) => (
        <span key={i}>
          {seg.text}
          {seg.marks.map((n, j) => {
            const r = refs.find((x) => x.number === n) || {};
            return <CitationMarker key={j} number={n} title={r.title} ref={r.ref} citedText={r.cited} />;
          })}
        </span>
      ))}
      {streaming ? (
        <span style={{
          display: "inline-block", width: 7, height: 15, marginLeft: "var(--space-2)", verticalAlign: -2,
          background: "var(--text-primary)", animation: "sb-pulse var(--pulse-caret) steps(1) infinite"
        }} />
      ) : null}
    </div>
  );
}
