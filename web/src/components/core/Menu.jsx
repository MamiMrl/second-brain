import React from "react";

export function Menu({ children, width, anchor = "bottom", style }) {
  const place = anchor === "bottom"
    ? { top: "calc(100% + 8px)" }
    : { bottom: "calc(100% + 8px)" };
  return (
    <div style={{
      position: "absolute", zIndex: "var(--z-menu)", width, ...place,
      background: "var(--surface-raised)", border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-panel)", boxShadow: "var(--shadow-menu)",
      padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-2)",
      animation: "sb-in var(--duration-micro) var(--ease-default) both", ...style
    }}>
      {children}
    </div>
  );
}

export function MenuItem({ label, description, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-2)",
        textAlign: "left", width: "100%", padding: "8px 10px", border: 0,
        borderRadius: "var(--radius-control)", cursor: "pointer",
        background: hover ? "var(--surface-hover)" : "transparent"
      }}
    >
      <span style={{ fontSize: "var(--text-ui)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)" }}>{label}</span>
      {description ? <span style={{ fontSize: "var(--text-mini)", lineHeight: "var(--leading-snug)", color: "var(--text-faint)" }}>{description}</span> : null}
    </button>
  );
}

export function MenuNote({ children }) {
  return (
    <div style={{
      padding: "7px 10px 4px", marginTop: "var(--space-2)", borderTop: "1px solid var(--border-subtle)",
      fontSize: "var(--text-micro)", lineHeight: "var(--leading-snug)", color: "var(--text-faint)"
    }}>{children}</div>
  );
}
