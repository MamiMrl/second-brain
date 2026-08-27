import React from "react";

export function StatRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-caption)", color: "var(--text-subtle)" }}>
      <span>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{value}</span>
    </div>
  );
}
