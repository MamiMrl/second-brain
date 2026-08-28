import React from "react";

export function ThreadItem({ title, selected, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: "left", width: "100%", padding: "7px 10px", border: 0, borderRadius: "var(--radius-item)",
        fontSize: "var(--text-ui)", lineHeight: "var(--leading-tight)", cursor: "pointer",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        background: selected ? "var(--surface-selected)" : hover ? "var(--surface-hover-sidebar)" : "transparent",
        color: selected ? "var(--text-primary)" : "var(--text-muted)",
      }}
    >
      {title}
    </button>
  );
}
