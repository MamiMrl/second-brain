import React from "react";

const DRAFT_KEY_PREFIX = "sb:draft:";

// Ticket #22: the composer's in-progress draft, persisted client-side
// (localStorage) so an accidental tab close or reload before sending
// doesn't lose what was typed. Scoped per conversation (or "new" before a
// conversation exists yet) — switching threads shouldn't leak one thread's
// draft into another's composer. Finalized messages remain server-only
// (Mongo, via appendMessage) — this never touches that store.
export function useDraft(scopeId) {
  const key = DRAFT_KEY_PREFIX + (scopeId ?? "new");
  const [draft, setDraftState] = React.useState(() => localStorage.getItem(key) ?? "");

  React.useEffect(() => {
    setDraftState(localStorage.getItem(key) ?? "");
  }, [key]);

  const setDraft = React.useCallback(
    (value) => {
      setDraftState(value);
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    },
    [key],
  );

  const clearDraft = React.useCallback(() => {
    setDraftState("");
    localStorage.removeItem(key);
  }, [key]);

  return [draft, setDraft, clearDraft];
}
