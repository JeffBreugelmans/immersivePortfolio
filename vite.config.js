import { defineConfig } from "vite";

export default defineConfig({
  // Served under /worlds on the Spark (path-based Tailscale Funnel routing
  // on port 443, chosen over a raw :8443 URL for a cleaner-looking link).
  // Local dev note: with this set, the dev server serves the app at
  // http://localhost:5173/worlds/ -- not the bare root.
  base: "/worlds/",

  // host: true so you can open the dev server from a Quest 3 browser
  // over your local network (https required for WebXR on-device -- see
  // docs/DEPLOYMENT.md for testing on headset via the Spark's public URL
  // instead).
  server: {
    host: true,
  },
});
