import React from "react";
import { Avatar } from "../core/Avatar.jsx";
import { Menu, MenuItem } from "../core/Menu.jsx";

export function ProfileButton({ name = "Muhammed Maral", initials = "MM", statusLabel = "Atlas index ready", onGeneral, onMemory }) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--border-default)", padding: "var(--space-8)", position: "relative" }}>
      {open ? (
        <Menu anchor="top" style={{ left: "var(--space-8)", right: "var(--space-8)", bottom: "calc(100% - 2px)" }}>
          <MenuItem label="General" description="Your details and appearance" onClick={() => { setOpen(false); onGeneral && onGeneral(); }} />
          <MenuItem label="Memory" description="What the model remembers, and standing instructions" onClick={() => { setOpen(false); onMemory && onMemory(); }} />
        </Menu>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "var(--space-9)", padding: "7px 8px",
          border: 0, borderRadius: "var(--radius-button)", cursor: "pointer", textAlign: "left",
          background: open ? "var(--surface-selected)" : hover ? "var(--surface-hover-sidebar)" : "transparent",
        }}
      >
        <Avatar initials={initials} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "var(--text-ui)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", fontSize: "var(--text-micro)", color: "var(--text-faint)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--status-ok)" }} />
            <span>{statusLabel}</span>
          </span>
        </span>
        <span style={{ fontSize: 9, color: "var(--text-faint)" }}>{open ? "▾" : "▴"}</span>
      </button>
    </div>
  );
}
