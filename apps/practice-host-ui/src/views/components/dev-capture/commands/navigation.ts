/** Moving around and acting on the page like a user. */
import { clickMatchingButton, delay, go, setNativeValue, sidebarLinks } from "../dom";
import { missing, type CaptureCommandGroup } from "../types";

let mouseOrigin: { x: number; y: number } | null = null;

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
    /** `value` = which exact match to click (0-based) when a label repeats. */
    clickText: (cmd) => (cmd.text ? { ok: clickMatchingButton(cmd.text, Number(cmd.value ?? 0) || 0) } : missing("text")),
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
    /**
     * Mouse gesture in steps, e.g. to hold a calendar drag mid-move for a screenshot.
     * `value`: "down" (presses on the centre of `selector`), "move:dx,dy" (relative to the press), "up".
     */
    mouse: (cmd) => {
        const step = cmd.value ?? "";
        if (step === "down") {
            const el = cmd.selector ? document.querySelector<Element>(cmd.selector) : null;
            if (!el) return { ok: false };
            const r = el.getBoundingClientRect();
            mouseOrigin = { x: r.left + r.width / 2, y: r.top + Math.min(12, r.height / 2) };
            el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: mouseOrigin.x, clientY: mouseOrigin.y }));
            return {};
        }
        if (!mouseOrigin) return { ok: false, error: "no mouse down" };
        if (step.startsWith("move:")) {
            const [dx, dy] = step.slice(5).split(",").map(Number);
            const at = { clientX: mouseOrigin.x + (dx || 0), clientY: mouseOrigin.y + (dy || 0) };
            window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, buttons: 1, ...at }));
            return {};
        }
        if (step === "up") {
            window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
            mouseOrigin = null;
            return {};
        }
        return missing("value");
    },
    /** Scrolls the first match into view (centered), for screenshots of long pages. */
    scrollIntoView: (cmd) => {
        if (!cmd.selector) return missing("selector");
        const el = document.querySelector<HTMLElement>(cmd.selector);
        el?.scrollIntoView({ block: "center" });
        return { ok: Boolean(el) };
    },
};
