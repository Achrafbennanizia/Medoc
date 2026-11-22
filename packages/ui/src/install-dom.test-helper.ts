/**
 * Test helper: a JSDOM document for component and hook tests (the test runner uses the node environment).
 * Import it first in a test file, before Testing Library renders anything.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://127.0.0.1" });
function installDomGlobal(key: string, value: unknown) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
installDomGlobal("window", dom.window);
installDomGlobal("document", dom.window.document);
installDomGlobal("HTMLElement", dom.window.HTMLElement);
installDomGlobal("Node", dom.window.Node);
installDomGlobal("IS_REACT_ACT_ENVIRONMENT", true);
