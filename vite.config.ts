import path from "path";
import { injectIWER } from "@iwsdk/vite-plugin-iwer";
import { defineConfig, type Plugin } from "vite";
import mkcert from "vite-plugin-mkcert";

const threePkg = path.resolve(__dirname, "node_modules/three");

/**
 * Redirect IWSDK's bundled super-three@0.177.0 imports to the project's
 * single Three.js instance (super-three@0.181.0, required by SparkJS 2.0),
 * preventing duplicate Three.js modules and the resulting
 * "Can not resolve #include <splatDefines>" shader error.
 *
 * Taken verbatim from the sensai-webxr-worldmodels template; can be dropped
 * once IWSDK publishes an npm release built against r181.
 */
function deduplicateThree(): Plugin {
  const bundledThreeRe =
    /node_modules\/@iwsdk\/core\/dist\/node_modules\/\.pnpm\/super-three@[\d.]+\/node_modules\/super-three\/(.*)/;

  return {
    name: "deduplicate-three",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return null;

      const resolved = source.startsWith(".")
        ? path.resolve(path.dirname(importer), source)
        : null;
      const target = resolved ?? source;
      const match = target.match(bundledThreeRe);
      if (match) {
        return path.join(threePkg, match[1]);
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    deduplicateThree(),
    // Locally-trusted HTTPS in dev: WebXR only exists in secure contexts,
    // and Quest browsers won't expose XR over plain http on the LAN.
    mkcert(),
    // Dev-only emulated Quest 3 (headset simulator on localhost). Not
    // injected into production builds (injectOnBuild defaults to false).
    injectIWER({
      device: "metaQuest3",
      activation: "localhost",
      verbose: true,
    }),
  ],
  resolve: {
    alias: {
      three: threePkg,
    },
    dedupe: ["three"],
  },
  // Served under jeffxr.com/worlds via Tailscale Funnel path mount.
  base: "/worlds/",
  server: { host: true },
  build: {
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== "production",
    target: "esnext",
    rollupOptions: { input: "./index.html" },
  },
  esbuild: { target: "esnext" },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
    esbuildOptions: { target: "esnext" },
  },
  publicDir: "public",
});
