/** Read-only inspection of the current page. */
import { ancestorChain, layoutReport, smallTargets } from "../probes";
import { missing, type CaptureCommandGroup } from "../types";

export const inspectCommands: CaptureCommandGroup = {
    pageText: () => ({
        path: window.location.pathname,
        text: document.body.innerText.slice(0, 3000),
        buttons: Array.from(document.querySelectorAll<HTMLElement>("button, [role=button]"))
            .map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim())
            .filter(Boolean)
            .slice(0, 60),
    }),
    layoutReport: () => layoutReport(),
    ancestors: (cmd) => (cmd.selector ? { chain: ancestorChain(document.querySelector<HTMLElement>(cmd.selector)) } : missing("selector")),
    targetAudit: () => {
        const small = smallTargets();
        return { path: window.location.pathname, count: small.length, small };
    },
};
