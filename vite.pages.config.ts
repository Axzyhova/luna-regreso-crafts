// Static build for GitHub Pages (SPA: client-only, no SSR worker).
// vite.config.ts (Lovable) stays untouched for the Lovable deploy.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const base = process.env.PAGES_BASE ?? "/luna-regreso-crafts/";

export default defineConfig({
  vite: { base },
  tanstackStart: {
    server: { entry: "server" },
    spa: { enabled: true },
  },
});
