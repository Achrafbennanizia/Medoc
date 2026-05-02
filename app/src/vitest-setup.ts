import "@testing-library/jest-dom/vitest";
import { JSDOM } from "jsdom";

/** Node 22+ can expose a broken global `localStorage` (without `.clear`). Vitest jsdom keeps it; normalize for all tests. */
if (typeof globalThis.localStorage?.clear !== "function") {
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
}
