import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  optimizeDeps: { include: ["@noble/hashes/sha2.js", "@noble/hashes/utils.js"] },
  // A aplicação usa o link do Vinext. O Vite isolado não injeta as variáveis do roteador.
  define: { "process.env": "{}" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../..", import.meta.url)),
      "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    },
  },
  server: { host: "127.0.0.1", port: 5180, strictPort: true },
});
