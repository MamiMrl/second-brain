import React from "react";

const VARIANTS = {
  primary: { background: "var(--action-solid)", color: "var(--action-solid-fg)", border: "1px solid var(--action-solid)" },
  secondary: { background: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-xs)" },
  ghost: { background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-default)" },
  quiet: { background: "transparent", color: "var(--text-muted)", border: "0" },
};

const SIZES = {
  sm: { padding: "4px 9px", fontSize: "var(--text-caption)", borderRadius: "var(--radius-control)" },
  md: { padding: "8px 10px", fontSize: "var(--text-ui)", borderRadius: "var(--radius-button)" },
};

export function Button({ variant = "secondary", size = "md", leadingGlyph, fullWidth, disabled, onClick, children, style }) {
  const [hover, setHover] = React.useState(false);
  const base = VARIANTS[variant] || VARIANTS.secondary;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-8)", justifyContent: leadingGlyph ? "flex-start" : "center",
        width: fullWidth ? "100%" : undefined, fontFamily: "var(--font-sans)", fontWeight: "var(--weight-medium)",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
        ...base, ...SIZES[size],
        ...(hover && !disabled ? (variant === "primary" ? { background: "var(--zinc-950)" } : { background: "var(--surface-hover)", color: "var(--text-primary)" }) : null),
        ...style,
      }}
    >
      {leadingGlyph ? <span style={{ fontSize: "var(--text-glyph)", lineHeight: 1, color: "var(--text-subtle)" }}>{leadingGlyph}</span> : null}
      <span>{children}</span>
    </button>
  );
}
