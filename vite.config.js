import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    historyApiFallback: true,
  },
  preview: {
    historyApiFallback: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase")) return "firebase";
          if (id.includes("node_modules/@emoji-mart/data")) return "emoji-data";
          if (id.includes("node_modules/emoji-mart")) return "emoji-lib";
          if (id.includes("node_modules/lucide-vue-next")) return "icons";
        },
      },
    },
  },
});
