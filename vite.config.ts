import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  server: { host: true, port: 5174 },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Night Market Ready!",
        short_name: "Night Market",
        description: "Light up a Thai night market — a cozy idle arcade.",
        lang: "en",
        theme_color: "#0b0d22",
        background_color: "#0b0d22",
        display: "fullscreen",
        orientation: "portrait",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        maximumFileSizeToCacheInBytes: 4_000_000, // Phaser vendor chunk is ~1.4 MB
      },
    }),
  ],
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
