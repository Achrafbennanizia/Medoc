import type { UnlistenFn } from "@tauri-apps/api/event";

/** Payload emitted from Rust → WebView for native menu actions. */
export type AppMenuPayload = {
    kind: string;
    path?: string;
    action?: string;
    topic?: string;
    version?: string;
};

/** Tauri may deliver JSON objects or stringified JSON depending on runtime path. */
export function normalizeAppMenuPayload(raw: unknown): AppMenuPayload | null {
    let version: unknown = raw;
    if (typeof version === "string") {
        try {
            version = JSON.parse(version) as unknown;
        } catch {
            return null;
        }
    }
    if (!version || typeof version !== "object") return null;
    const o = version as Record<string, unknown>;
    if (typeof o.kind !== "string") return null;
    return o as AppMenuPayload;
}

/**
 * Subscribe to `app-menu` on the current webview window (Tauri 2 — reliable with {@link Emitter} from Rust).
 * Falls back to global `listen` if needed; returns undefined in a plain browser build.
 */
export async function subscribeAppMenu(handler: (p: AppMenuPayload) => void): Promise<UnlistenFn | undefined> {
    const wrapped = (event: { payload: unknown }) => {
        const p = normalizeAppMenuPayload(event.payload);
        if (p) handler(p);
    };
    try {
        const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        return await getCurrentWebviewWindow().listen("app-menu", wrapped);
    } catch {
        try {
            const { listen } = await import("@tauri-apps/api/event");
            return await listen("app-menu", wrapped);
        } catch {
            return undefined;
        }
    }
}
