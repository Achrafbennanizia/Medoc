import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://127.0.0.1" });
Object.defineProperty(globalThis, "localStorage", {
    value: dom.window.localStorage,
    configurable: true,
    writable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
    value: dom.window.sessionStorage,
    configurable: true,
    writable: true,
});

/**
 * jsdom: ensure matchMedia for app-layout breakpoint.
 * Default jsdom can report false for (min-width: 900px), which hides the sidebar profile menu button
 * and breaks smoke tests that open logout from the sidebar.
 */
Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
        matches: /min-width:\s*900px/.test(query),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});

/** Dynamic import so Zustand persist loads after the storage shim (ESM import hoisting). */
const { initI18n } = await import("@/lib/i18n");
/** Smoke/unit tests assert English UI copy; production default locale remains German. */
initI18n("en");
