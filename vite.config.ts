import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: true, port: 5174 },
  build: {
    target: "es2020",
    sourcemap: true,
    chunkSizeWarningLimit: 1600, // Phaser is ~1.4MB; intentionally one vendor chunk
    rollupOptions: {
      output: {
        manualChunks: { phaser: ["phaser"] },
      },
    },
  },
});
