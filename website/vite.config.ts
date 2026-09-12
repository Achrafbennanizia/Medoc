import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "..");
const practiceUi = path.resolve(repo, "apps/practice-host-ui");
const shared = path.resolve(repo, "packages/shared/src");
const ui = path.resolve(repo, "packages/ui/src");

function scopePracticeHostCss(): Plugin {
  return {
    name: "scope-practice-host-css",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("?url") || id.includes("?transform-only")) return;
      const norm = id.split("?")[0].replace(/\\/g, "/");
      if (!norm.endsWith("apps/practice-host-ui/src/index.css")) return;
      let next = code.replace(/@tailwind\s+[^;]+;/g, "");
      next = next.replace(/@import url\([^)]+\);\s*/g, "");
      next = next.replace(/--app-viewport-min-width:\s*1024px/g, "--app-viewport-min-width: 0px");
      next = next.replace(/--app-viewport-min-height:\s*800px/g, "--app-viewport-min-height: 0px");
      next = next.replace(/:root\b/g, ":host");
      next = next.replace(/html\[data-theme="dark"\]/g, ':host-context(html[data-theme="dark"])');
      next = next.replace(/\bhtml,\s*body,\s*#root\b/g, ":host");
      next = next.replace(/\bhtml,\s*body\b/g, ":host");
      return {
        code: `:host{display:block;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;font-size:14px;letter-spacing:-0.005em;font-family:var(--font-ui,Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--fg);background:var(--bg);}
${next}`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), scopePracticeHostCss()],
  resolve: {
    alias: [
      { find: "@/lib", replacement: path.join(shared, "lib") },
      { find: "@/models", replacement: path.join(shared, "models") },
      { find: "@/views/components/ui", replacement: ui },
      { find: "@medoc/ui", replacement: ui },
      { find: "@medoc/shared", replacement: shared },
      { find: "#shared-locales", replacement: path.resolve(repo, "packages/shared/locales") },
      { find: "@", replacement: path.join(practiceUi, "src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    fs: { allow: [repo] },
  },
});
