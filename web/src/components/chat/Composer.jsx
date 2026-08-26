import React from "react";
import { IconButton } from "../core/IconButton.jsx";
import { Menu, MenuItem, MenuNote } from "../core/Menu.jsx";

export function Composer({ value, onChange, onSubmit, onStop, busy, scopeNote, placeholder = "Ask about your documents…" }) {
  const [ingestOpen, setIngestOpen] = React.useState(false);
  return (
    <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <div style={{
        position: "relative", display: "flex", alignItems: "flex-end", gap: "var(--space-8)", padding: "var(--space-10)",
        background: "var(--surface-raised)", border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-composer)", boxShadow: "var(--shadow-sm)"
      }}>
        {ingestOpen ? (
          <Menu anchor="top" width={300} style={{ left: 0 }}>
            <MenuItem label="Ingest files" description="PDFs, recipes, fitness notes, Kindle exports" onClick={() => setIngestOpen(false)} />
            <MenuItem label="Ingest a folder" description="Walked recursively, type auto-detected" onClick={() => setIngestOpen(false)} />
            <MenuNote>Re-ingesting the same path is idempotent — unchanged files are skipped.</MenuNote>
          </Menu>
        ) : null}
        <IconButton glyph="+" title="Ingest documents" active={ingestOpen} onClick={() => setIngestOpen(!ingestOpen)} />
        <textarea
          rows={1}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit && onSubmit(); } }}
          placeholder={placeholder}
          style={{
            flex: 1, minHeight: 30, maxHeight: 160, resize: "none", border: 0, outline: "none",
            background: "transparent", lineHeight: "var(--leading-normal)", padding: "5px 4px"
          }}
        />
        {busy ? (
          <IconButton variant="solid" title="Stop generating" onClick={onStop}>
            <span style={{ width: 10, height: 10, borderRadius: "var(--radius-xs)", background: "var(--action-solid-fg)" }} />
          </IconButton>
        ) : (
          <IconButton glyph="↑" variant={value && value.trim() ? "solid" : "disabled"} onClick={onSubmit} />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-mini)", color: "var(--text-faint)" }}>
        <span>{scopeNote}</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>Enter to send · Shift+Enter newline</span>
      </div>
    </div>
  );
}
