import React from "react";

export function IconButton({ glyph, variant = "outline", title, onClick, active, children, style }) {
  const [hover, setHover] = React.useState(false);
  const solid = variant === "solid";
  const disabled = variant === "disabled";
  return (
    <button
      type="button"
      title={title}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: "0 0 auto", width: "var(--control-size)", height: "var(--control-size)",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "var(--radius-button)", cursor: disabled ? "default" : "pointer",
        fontSize: "var(--text-glyph)", lineHeight: 1,
        border: solid || disabled ? "0" : "1px solid var(--border-default)",
        background: disabled ? "var(--action-disabled)" : solid ? "var(--action-solid)" : active ? "var(--surface-muted)" : "var(--surface-raised)",
        color: solid || disabled ? "var(--action-solid-fg)" : "var(--text-muted)",
        ...(hover && !disabled && !solid ? { background: "var(--surface-hover)", color: "var(--text-primary)" } : null),
        ...style
      }}
    >
      {children || glyph}
    </button>
  );
}
