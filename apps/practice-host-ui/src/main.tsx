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
    await bootstrapDocumentLocale();

    // UI errors → client.log / errors.log in the desktop app (docs/architecture/logging.md).
    if ("__TAURI_INTERNALS__" in window) {
        const { setClientLogSink, installGlobalErrorReporting } = await import("@/lib/client-log");
        const { invoke } = await import("@tauri-apps/api/core");
        setClientLogSink((event) => invoke("log_client_event", { event }));
        installGlobalErrorReporting();

        // A UI built for one edition must not run on a core of another (editions-plan.md §3.2).
        const { editionMismatch } = await import("@/lib/edition");
        const mismatch = editionMismatch(await invoke("edition_info"));
        if (mismatch.length > 0) {
            console.error("[medoc] edition mismatch", mismatch);
            const root = document.getElementById("root")!;
            const { t } = await import("@/lib/i18n");
            root.textContent = `${t("error.device.edition_mismatch")} (${mismatch.join("; ")})`;
            return;
        }
    }

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
