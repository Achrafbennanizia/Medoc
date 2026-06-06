import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = __dirname;

const medocAliases = [
    {
        find: "@/systems/practice-host/adapters/tauri-practice.adapter",
        replacement: path.resolve(root, "src/practice-http-shim.ts"),
    },
    {
        find: "@/systems/practice-host/adapters/practice-transport",
        replacement: path.resolve(root, "src/practice-http-shim.ts"),
    },
    { find: "@/lib", replacement: path.resolve(root, "../../packages/shared/src/lib") },
    { find: "@/models", replacement: path.resolve(root, "../../packages/shared/src/models") },
    { find: "@/views/components/ui", replacement: path.resolve(root, "../../packages/ui/src") },
    { find: "@/systems/practice-host", replacement: path.resolve(root, "../../packages/app/practice-host/src") },
    { find: "@/systems/lan", replacement: path.resolve(root, "../../packages/server/lan/src") },
    { find: "@medoc/shared", replacement: path.resolve(root, "../../packages/shared/src") },
    { find: "@medoc/ui", replacement: path.resolve(root, "../../packages/ui/src") },
    { find: "@medoc/system-practice", replacement: path.resolve(root, "../../packages/app/practice-host/src") },
    { find: "@medoc/system-lan", replacement: path.resolve(root, "../../packages/server/lan/src") },
    { find: "@", replacement: path.resolve(root, "src") },
];

export default defineConfig({
    plugins: [react()],
    resolve: { alias: medocAliases },
    server: {
        port: 1421,
        strictPort: true,
    },
});
