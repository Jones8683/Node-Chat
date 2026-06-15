import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const host = process.env.TAURI_DEV_HOST;
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
};

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || "localhost",
    headers: securityHeaders,
    hmr: host
      ? { protocol: "ws", host, port: 5174 }
      : { host: "localhost", port: 5173 },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  preview: {
    headers: securityHeaders,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  optimizeDeps: {
    include: [
      "vue",
      "firebase/app",
      "firebase/auth",
      "firebase/database",
      "lucide-vue-next",
      "clipboard-copy",
      "crypto-random-string",
    ],
    exclude: ["@emoji-mart/data", "emoji-mart"],
  },
  build: {
    target: "esnext",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase")) return "firebase";
          if (id.includes("node_modules/@emoji-mart/data")) return "emoji-data";
          if (id.includes("node_modules/emoji-mart")) return "emoji-lib";
          if (id.includes("node_modules/lucide-vue-next")) return "icons";
          if (id.includes("node_modules/@tauri-apps")) return "tauri";
        },
      },
    },
  },
});
