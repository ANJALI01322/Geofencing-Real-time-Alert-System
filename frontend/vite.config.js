import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nm = (pkg) => path.resolve(__dirname, "node_modules", pkg);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "lucide-react":  nm("lucide-react/dist/cjs/lucide-react.js"),
      "date-fns":      nm("date-fns/index.cjs"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
