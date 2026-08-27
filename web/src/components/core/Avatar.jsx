import React from "react";

export function Avatar({ initials = "MM", size = 24, brand, style }) {
  if (brand) {
    return (
      <div
        style={{
          flex: "0 0 " + size + "px", width: size, height: size, borderRadius: "var(--radius-item)",
          background: "var(--action-solid)", display: "flex", alignItems: "center", justifyContent: "center", ...style,
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: "var(--radius-xs)", background: "var(--action-solid-fg)" }} />
      </div>
    );
  }
  return (
    <span
      style={{
        flex: "0 0 " + size + "px", width: size, height: size, borderRadius: "50%",
        background: "var(--border-default)", border: "1px solid var(--border-avatar)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "var(--text-micro)", fontWeight: "var(--weight-semibold)", color: "var(--text-muted)", ...style,
      }}
    >
      {initials}
    </span>
  );
}
