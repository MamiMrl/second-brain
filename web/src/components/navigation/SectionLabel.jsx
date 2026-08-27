import React from "react";

export function SectionLabel({ children }) {
  return (
    <div
      style={{
        padding: "14px 20px 6px", fontSize: "var(--text-micro)", fontWeight: "var(--weight-medium)",
        letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-faint)",
      }}
    >
      {children}
    </div>
  );
}
