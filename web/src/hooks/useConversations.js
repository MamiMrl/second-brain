import { useQuery } from "@tanstack/react-query";

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.json();
}

// Ticket #22: the sidebar's recent-conversations list (GET /conversations).
export function useConversationList() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetchJson("/conversations"),
  });
}

// Ticket #22: one conversation's persisted messages (GET /conversations/:id),
// for restoring a running transcript on reload or on switching threads.
export function useConversation(conversationId) {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => fetchJson(`/conversations/${conversationId}`),
    enabled: Boolean(conversationId),
  });
}
