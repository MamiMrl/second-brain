import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API requests to the chat server (src/scripts/chat-server.ts,
// see ticket #19) so `npm run dev` here can hit a real backend without CORS setup.
// The production build (`vite build`) is served by that same backend as a
// static bundle — one process, per the map's always-on-service decision.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/conversations": "http://127.0.0.1:4319",
    },
  },
});
