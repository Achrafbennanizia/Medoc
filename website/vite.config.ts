import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Package: medoc-dentist. GitHub Pages path is /Medoc/ (repo name) until medoc.sifralabs.com.
  base: process.env.GITHUB_ACTIONS ? "/Medoc/" : "/",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
});
