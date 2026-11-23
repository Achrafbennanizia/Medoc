/**
 * DEV only: polls Vite's `/__medoc_capture` bridge (vite.config.ts) so screenshot scripts can drive the
 * desktop window. Transport only — what each command does lives in commands/ (registry.ts).
 */
import { runCaptureCommand } from "./registry";
import type { CaptureCommand } from "./types";

const POLL_MS = 350;
let started = false;
const seen = new Set<string>();

export function startDevCaptureLoop(): void {
    if (!import.meta.env.DEV || started || typeof window === "undefined") return;
    // Only the desktop window answers; a browser tab on the dev server used to take half the commands.
    if (!("__TAURI_INTERNALS__" in window)) return;
    started = true;
    const bridge = `${window.location.origin}/__medoc_capture`;
    let inFlight = false;
    window.setInterval(() => {
        if (inFlight) return;
        inFlight = true;
        void pollOnce(bridge).finally(() => {
            inFlight = false;
        });
    }, POLL_MS);
}

async function pollOnce(bridge: string): Promise<void> {
    try {
        const r = await fetch(`${bridge}/cmd`, { cache: "no-store" });
        if (!r.ok) return;
        const cmd = (await r.json()) as CaptureCommand | null;
        if (!cmd?.op) {
            await fetch(`${bridge}/hello`, { method: "POST" }).catch(() => undefined);
            return;
        }
        if (cmd.id && seen.has(cmd.id)) return;
        if (cmd.id) seen.add(cmd.id);
        const result = await runCaptureCommand(cmd);
        await fetch(`${bridge}/ack`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cmd.id, ...result }) });
    } catch {
        /* bridge down */
    }
}
