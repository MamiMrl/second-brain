import React from "react";

export function CitationMarker({ number, title, ref: refLabel, citedText }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: "relative", display: "inline-block", marginLeft: "var(--space-2)", verticalAlign: "super", fontSize: "10.5px", fontFamily: "var(--font-mono)" }}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 15, height: 15, padding: "0 4px", borderRadius: "var(--radius-sm)", cursor: "default",
        background: open ? "var(--action-solid)" : "var(--surface-muted)",
        color: open ? "var(--action-solid-fg)" : "var(--text-muted)"
      }}>{number}</span>
      {open ? (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          width: 320, zIndex: "var(--z-popover)", background: "var(--surface-raised)",
          border: "1px solid var(--border-default)", borderRadius: "var(--radius-panel)",
          boxShadow: "var(--shadow-popover)", padding: "12px 13px", display: "block", textAlign: "left",
          fontFamily: "var(--font-sans)", animation: "sb-in var(--duration-micro) var(--ease-default) both"
        }}>
          <span style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-10)", alignItems: "baseline" }}>
            <span style={{ fontSize: "var(--text-detail)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>{title}</span>
            <span style={{ fontSize: "var(--text-micro)", fontFamily: "var(--font-mono)", color: "var(--text-faint)", whiteSpace: "nowrap" }}>{refLabel}</span>
          </span>
          <span style={{
            display: "block", marginTop: "var(--space-8)", paddingLeft: "var(--space-10)",
            borderLeft: "2px solid var(--border-default)", fontSize: "var(--text-detail)",
            lineHeight: "var(--leading-normal)", color: "var(--text-muted)"
          }}>{citedText}</span>
        </span>
      ) : null}
    </span>
  );
}
