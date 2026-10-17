// @ts-check
import { defineConfig } from "astro/config";

// Situs statis penuh: tidak ada server dan tidak ada basis data saat jalan.
// Berkas hasil build dapat disalin ke USB dan dibuka langsung, karena itu
// `base` dibiarkan relatif dan tidak ada adapter.
export default defineConfig({
  output: "static",
  trailingSlash: "ignore",
  build: { assets: "aset", inlineStylesheets: "always", format: "file" },
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: {
    build: {
      // Satu halaman, satu berkas skrip kecil. Tidak ada pustaka charting.
      assetsInlineLimit: 0,
      cssCodeSplit: false,
    },
  },
});
