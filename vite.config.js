import { defineConfig } from "vite";

export default defineConfig({
  // host: true so you can open the dev server from a Quest 3 browser
  // over your local network (https required for WebXR on-device — see
  // README for the ngrok/tailscale note on testing on headset).
  server: {
    host: true,
  },
});
