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
        const el = document.querySelector<HTMLElement>(cmd.selector);
        el?.click();
        return { ok: Boolean(el) };
    },
    fill: (cmd) => {
        if (!cmd.selector) return missing("selector");
        const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(cmd.selector);
        if (el) setNativeValue(el, cmd.value ?? "");
        return { ok: Boolean(el) };
    },
};
