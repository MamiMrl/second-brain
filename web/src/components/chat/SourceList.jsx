import React from "react";

export function SourceList({ refs = [], defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [hover, setHover] = React.useState(false);
  if (refs.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "var(--space-6)",
          padding: "4px 9px 4px 8px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-control)",
          fontSize: "var(--text-caption)", fontWeight: "var(--weight-medium)", cursor: "pointer",
          background: hover ? "var(--surface-sidebar)" : "transparent",
          color: hover ? "var(--text-primary)" : "var(--text-muted)"
        }}
      >
        <span style={{ fontSize: 9, color: "var(--text-faint)" }}>{open ? "▾" : "▸"}</span>
        <span>{refs.length} {refs.length === 1 ? "source" : "sources"}</span>
      </button>
      {open ? (
        <div style={{
          display: "flex", flexDirection: "column", gap: "var(--space-1)",
          border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-panel)",
          overflow: "hidden", background: "var(--surface-sidebar)"
        }}>
          {refs.map((r) => (
            <div key={r.number} style={{ display: "flex", gap: "var(--space-10)", padding: "11px 13px", background: "var(--surface-raised)" }}>
              <span style={{
                flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 18, height: 18, marginTop: 1, padding: "0 5px", borderRadius: "var(--radius-badge)",
                background: "var(--surface-muted)", color: "var(--text-muted)",
                fontSize: "var(--text-micro)", fontFamily: "var(--font-mono)"
              }}>{r.number}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minWidth: 0 }}>
                <span style={{ fontSize: "var(--text-ui)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)" }}>{r.title}</span>
                <span style={{ fontSize: "var(--text-mini)", fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{r.ref}</span>
                <span style={{ fontSize: "var(--text-detail)", lineHeight: "var(--leading-normal)", color: "var(--text-muted)", marginTop: "var(--space-2)" }}>{r.cited}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
