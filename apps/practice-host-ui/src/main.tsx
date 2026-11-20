import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./views/components/error-boundary";
import "./index.css";

/**
 * Boot order is load-bearing:
 * 1) Apply cached appearance (accent/theme) synchronously so the default mint
 *    CSS vars are not painted/animated before the real preset loads.
 * 2) Hydrate from per-instance `ui-prefs.json` (writes localStorage cache).
 * 3) Re-apply appearance after disk wins; then import i18n so zustand persist
 *    cannot apply another window's shared-origin English before the file wins.
 */
async function boot(): Promise<void> {
    const { hydrateAppearanceFromStorage, initAppearanceMediaListener } = await import(
        "@/lib/client-settings"
    );
    // Sync cache first — avoids wrong accent during the disk-await / page enter animation.
    hydrateAppearanceFromStorage();

    try {
        const { hydrateUiPrefsFromDisk } = await import(
            "@/systems/practice-host/controllers/ui-prefs.controller"
        );
        await hydrateUiPrefsFromDisk();
    } catch {
        /* browser tests / no Tauri */
    }

    const { bootstrapDocumentLocale } = await import("@/lib/i18n");
    const { startDevCaptureLoop } = await import("./views/components/dev-capture-poller");

    hydrateAppearanceFromStorage();
    initAppearanceMediaListener();
    bootstrapDocumentLocale();

    if (import.meta.env.DEV) {
        startDevCaptureLoop();
    }

    ReactDOM.createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </React.StrictMode>,
    );
}

void boot();
