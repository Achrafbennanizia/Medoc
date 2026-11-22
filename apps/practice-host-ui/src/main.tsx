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
    // #region agent log
    fetch('http://127.0.0.1:7291/ingest/07a92a91-f77a-4e81-95d8-be425fb76d8d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'969bd8'},body:JSON.stringify({sessionId:'969bd8',runId:'post-fix',hypothesisId:'A',location:'main.tsx:boot-start',message:'boot() entered — module graph loading',data:{href:String(location.href),viteHost:location.host},timestamp:Date.now()})}).catch(()=>{});
    window.addEventListener('error', (ev) => {
        fetch('http://127.0.0.1:7291/ingest/07a92a91-f77a-4e81-95d8-be425fb76d8d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'969bd8'},body:JSON.stringify({sessionId:'969bd8',runId:'post-fix',hypothesisId:'C',location:'main.tsx:window-error',message:String(ev.message||'error'),data:{filename:String(ev.filename||''),lineno:ev.lineno||0},timestamp:Date.now()})}).catch(()=>{});
    });
    // #endregion
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

    // UI errors → client.log / errors.log in the desktop app (docs/architecture/logging.md).
    if ("__TAURI_INTERNALS__" in window) {
        const { setClientLogSink, installGlobalErrorReporting } = await import("@/lib/client-log");
        const { invoke } = await import("@tauri-apps/api/core");
        setClientLogSink((event) => invoke("log_client_event", { event }));
        installGlobalErrorReporting();
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
    // #region agent log
    fetch('http://127.0.0.1:7291/ingest/07a92a91-f77a-4e81-95d8-be425fb76d8d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'969bd8'},body:JSON.stringify({sessionId:'969bd8',runId:'post-fix',hypothesisId:'A',location:'main.tsx:boot-rendered',message:'React root rendered successfully',data:{hasRoot:!!document.getElementById('root')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
}

void boot();
