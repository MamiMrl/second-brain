import { create } from "zustand";

// Ticket #20: the current live pipeline-step status, replaced as each SSE
// "status" event arrives on the conversation's stream (see useChatStream.js)
// and cleared once the final answer lands. Its own store (rather than
// App.jsx state) so StatusLine can subscribe without re-rendering the whole
// message list on every step.
export const useChatStatusStore = create((set) => ({
  step: null,
  setStep: (step) => set({ step }),
  clear: () => set({ step: null }),
}));
