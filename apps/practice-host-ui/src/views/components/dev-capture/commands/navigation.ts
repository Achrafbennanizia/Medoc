/** Moving around and acting on the page like a user. */
import { clickMatchingButton, delay, go, setNativeValue, sidebarLinks } from "../dom";
import { missing, type CaptureCommandGroup } from "../types";

export const navigationCommands: CaptureCommandGroup = {
    clickSidebar: (cmd) => {
        if (!cmd.href) return missing("href");
        const want = cmd.href;
        const hit = sidebarLinks().find((a) => {
            const h = a.getAttribute("href") ?? "";
            return h === want || h.endsWith(want);
        });
        if (hit) hit.click();
        else go(want);
        return {};
    },
    navigate: async (cmd) => {
        if (!cmd.path) return missing("path");
        // Client-side route change (BrowserRouter listens to popstate).
        window.history.pushState(null, "", cmd.path);
        window.dispatchEvent(new PopStateEvent("popstate"));
        await delay(400);
        return { path: window.location.pathname };
    },
    clickText: (cmd) => (cmd.text ? { ok: clickMatchingButton(cmd.text) } : missing("text")),
    clickSelector: (cmd) => {
        if (!cmd.selector) return missing("selector");
        const el = document.querySelector<Element>(cmd.selector);
        // SVG elements (e.g. odontogram teeth) have no .click(); dispatch the event instead.
        if (el instanceof HTMLElement) el.click();
        else el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return { ok: Boolean(el) };
    },
    fill: (cmd) => {
        if (!cmd.selector) return missing("selector");
        const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(cmd.selector);
        if (el) setNativeValue(el, cmd.value ?? "");
        return { ok: Boolean(el) };
    },
    /** Picks an option in a native <select> so React's onChange fires. */
    selectValue: (cmd) => {
        if (!cmd.selector) return missing("selector");
        const el = document.querySelector<HTMLSelectElement>(cmd.selector);
        if (!(el instanceof HTMLSelectElement)) return { ok: false };
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(el, cmd.value ?? "");
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: el.value === cmd.value };
    },
    /** Scrolls the first match into view (centered), for screenshots of long pages. */
    scrollIntoView: (cmd) => {
        if (!cmd.selector) return missing("selector");
        const el = document.querySelector<HTMLElement>(cmd.selector);
        el?.scrollIntoView({ block: "center" });
        return { ok: Boolean(el) };
    },
};
