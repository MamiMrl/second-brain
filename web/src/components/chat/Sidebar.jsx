import React from "react";
import { Button } from "../core/Button.jsx";
import { Avatar } from "../core/Avatar.jsx";
import { SectionLabel } from "../navigation/SectionLabel.jsx";
import { ThreadItem } from "../navigation/ThreadItem.jsx";
import { StatRow } from "../navigation/StatRow.jsx";
import { ProfileButton } from "../navigation/ProfileButton.jsx";

// Ticket #22: the recent-conversations list, fed by GET /conversations
// (see web/src/hooks/useConversations.js) instead of the design kit's canned
// thread titles. Corpus stats (documents/chunks indexed) aren't backed by an
// endpoint yet — same "not built" placeholder as the design kit ships with.
export function Sidebar({ threads, activeConversationId, onSelectThread, onNewThread }) {
  return (
    <aside style={{ width: "var(--sidebar-width)", flex: "0 0 var(--sidebar-width)", display: "flex", flexDirection: "column", background: "var(--surface-sidebar)", borderRight: "1px solid var(--border-default)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", padding: "16px 16px 12px" }}>
        <Avatar brand size={22} />
        <div style={{ fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-title)" }}>Second Brain</div>
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <Button variant="secondary" leadingGlyph="+" fullWidth onClick={onNewThread}>New question</Button>
      </div>
      <SectionLabel>Recent</SectionLabel>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {threads.map((t) => (
          <ThreadItem key={t._id} title={t.title} selected={t._id === activeConversationId} onClick={() => onSelectThread(t._id)} />
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--border-default)", padding: "12px 16px 10px", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <StatRow label="Documents" value="—" />
        <StatRow label="Chunks indexed" value="—" />
      </div>
      <ProfileButton />
    </aside>
  );
}
