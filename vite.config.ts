import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  cacheDir: ".vite-cache",
  plugins: [
    tailwindcss(),
    react(),
    ...(process.env.ANALYZE
      ? [
          visualizer({
            filename: "dist/stats.html",
            gzipSize: true,
            brotliSize: true,
            template: "treemap",
          }),
          visualizer({
            filename: "dist/stats.json",
            gzipSize: true,
            brotliSize: true,
            template: "raw-data",
          }),
        ]
      : []),
  ],
});
