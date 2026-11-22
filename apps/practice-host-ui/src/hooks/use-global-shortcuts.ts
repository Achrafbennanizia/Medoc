import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { routeChildPathAllowed } from "@/lib/rbac";
import { GO_TO_SEQUENCES } from "@/lib/shortcuts";
import { useAuthStore } from "@/models/store/auth-store";

const SEQUENCE_WINDOW_MS = 1500;

function isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (target.isContentEditable) return true;
    return Boolean(target.closest('[role="dialog"]'));
}

/** Focus the page's search field: `[data-page-search]`, else the first search input in <main>. */
function focusPageSearch(): boolean {
    const main = document.getElementById("main-content") ?? document.body;
    const el =
        main.querySelector<HTMLInputElement>("[data-page-search]") ??
        main.querySelector<HTMLInputElement>('input[type="search"]') ??
        main.querySelector<HTMLInputElement>('input[placeholder*="…"]');
    if (!el) return false;
    el.focus();
    el.select?.();
    return true;
}

/**
 * App-wide keyboard shortcuts documented in `@/lib/shortcuts` (Help → Keyboard shortcuts):
 * G-then-letter go-to, ⌘/ shortcut list, ⌘, settings, / search, ⇧⌘N new patient, ⇧⌘T new task.
 * Respects the role: a shortcut never opens a page the user may not see. Ignored while typing.
 */
export function useGlobalShortcuts(): void {
    const navigate = useNavigate();
    const pendingG = useRef<number>(0);

    useEffect(() => {
        const allowedRoute = (routeKey: string) => {
            if (!routeKey) return true;
            const s = useAuthStore.getState().session;
            return routeChildPathAllowed(routeKey, s?.role, s?.permission_overrides);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.repeat) return;
            const mod = e.metaKey || e.ctrlKey;
            const key = e.key.toLowerCase();

            if (mod && !e.altKey) {
                if (key === "/" || e.code === "Slash") {
                    e.preventDefault();
                    navigate("/help?tab=shortcuts");
                    return;
                }
                if (key === "," && !e.shiftKey) {
                    if (!allowedRoute("settings")) return;
                    e.preventDefault();
                    navigate("/settings");
                    return;
                }
                if (e.shiftKey && key === "n" && !isTyping(e.target)) {
                    if (!allowedRoute("patients/new")) return;
                    e.preventDefault();
                    navigate("/patients/new");
                    return;
                }
                if (e.shiftKey && key === "t" && !isTyping(e.target)) {
                    if (!allowedRoute("tickets/new")) return;
                    e.preventDefault();
                    navigate("/tickets/new");
                }
                return;
            }
            if (e.altKey || isTyping(e.target)) return;

            if (key === "/" && !e.shiftKey) {
                if (focusPageSearch()) e.preventDefault();
                return;
            }
            const now = Date.now();
            if (pendingG.current && now - pendingG.current < SEQUENCE_WINDOW_MS) {
                pendingG.current = 0;
                const target = GO_TO_SEQUENCES.find((g) => g.key === key);
                if (target && allowedRoute(target.routeKey)) {
                    e.preventDefault();
                    navigate(target.route);
                }
                return;
            }
            if (key === "g" && !e.shiftKey) {
                pendingG.current = now;
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [navigate]);
}
