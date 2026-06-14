import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Push Chat (@pushprotocol/restapi) expects Node globals (Buffer/process).
    // Scoped to what it needs; harmless for the rest of the app.
    nodePolyfills({ include: ["buffer", "process", "util", "stream", "events"], globals: { Buffer: true, process: true } }),
  ],
  // XMTP browser SDK runs its WASM bindings in a Web Worker with an OPFS-backed
  // SQLite store. esbuild dep-prebundling can't handle the WASM packages, and the
  // glue uses top-level await — so exclude the SDK from optimizeDeps and target
  // esnext. COOP/COEP are NOT needed (it uses the SyncAccessHandle Pool VFS, which
  // doesn't require SharedArrayBuffer). The SDK is loaded lazily (dynamic import)
  // from the Messenger page, so it never weighs on the rest of the app.
  optimizeDeps: {
    exclude: ["@xmtp/browser-sdk", "@xmtp/wasm-bindings"],
    include: ["@xmtp/proto"],
    esbuildOptions: { target: "esnext" },
  },
  worker: { format: "es" },
  build: { target: "esnext" },
});
