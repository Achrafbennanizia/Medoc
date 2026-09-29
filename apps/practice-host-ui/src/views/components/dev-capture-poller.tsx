/**
 * DEV-only: polls Vite `/__medoc_capture` so screenshot scripts can drive the Tauri window.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    applyAppearanceFromSettings,
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    mergeClientSettingsPatch,
    saveClientSettings,
    type ColorSchemeId,
} from "@/lib/client-settings";
import { useLocale, type Locale } from "@/lib/i18n";
import { useAuthStore } from "@/models/store/auth-store";
import { logout } from "@/systems/practice-host/controllers/auth.controller";

const BRIDGE = `${typeof window !== "undefined" ? window.location.origin : "http://localhost:1420"}/__medoc_capture`;

type CaptureNav = (href: string, opts?: { replace?: boolean }) => void;

declare global {
    interface Window {
        __medocCaptureNavigate?: CaptureNav;
    }
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    const tracker = (el as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
    tracker?.setValue("");
    setter?.call(el, value);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

function delay(ms: number): Promise<void> {
    return new Promise((r) => window.setTimeout(r, ms));
}

function clickLogoutConfirm(): boolean {
    const btn =
        document.querySelector<HTMLElement>(".ios-confirm-btn--destructive") ??
        document.querySelector<HTMLElement>(".modal--ios-confirm .ios-confirm-btn--primary");
    btn?.click();
    return Boolean(btn);
}

function loginEmailInput(): HTMLInputElement | null {
    return (
        document.querySelector<HTMLInputElement>("form.login-form input[type='email']") ??
        document.querySelector<HTMLInputElement>("form.login-form #email")
    );
}

function loginPasswordInput(): HTMLInputElement | null {
    return (
        document.querySelector<HTMLInputElement>("form.login-form input[type='password']") ??
        document.querySelector<HTMLInputElement>("form.login-form #password")
    );
}

function clickMatchingButton(text: string): boolean {
    const want = text.trim().toLowerCase();
    const nodes = Array.from(document.querySelectorAll("button, [role='menuitem'], a.sb-item"));
    const hit = nodes.find((n) => (n.textContent ?? "").trim().toLowerCase() === want);
    if (hit instanceof HTMLElement) {
        hit.click();
        return true;
    }
    const partial = nodes.find((n) => (n.textContent ?? "").trim().toLowerCase().includes(want));
    if (partial instanceof HTMLElement) {
        partial.click();
        return true;
    }
    return false;
}

function go(href: string, replace = false) {
    const nav = window.__medocCaptureNavigate;
    if (nav) {
        nav(href, { replace });
        return;
    }
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a.sb-item"));
    const hit = links.find((a) => (a.getAttribute("href") ?? "") === href || (a.getAttribute("href") ?? "").endsWith(href));
    if (hit) {
        hit.click();
        return;
    }
    window.history[replace ? "replaceState" : "pushState"](null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

type Cmd = {
    id?: string;
    op: string;
    href?: string;
    text?: string;
    selector?: string;
    email?: string;
    password?: string;
    locale?: Locale;
    theme?: ColorSchemeId;
};

let loopStarted = false;

export function startDevCaptureLoop(): void {
    if (!import.meta.env.DEV || loopStarted || typeof window === "undefined") return;
    loopStarted = true;
    let inFlight = false;
    window.setInterval(() => {
        void (async () => {
            if (inFlight) return;
            inFlight = true;
            try {
                const r = await fetch(`${BRIDGE}/cmd`, { cache: "no-store" });
                if (!r.ok) return;
                const cmd = (await r.json()) as Cmd | null;
                if (!cmd || !cmd.op) {
                    await fetch(`${BRIDGE}/hello`, { method: "POST" }).catch(() => undefined);
                    return;
                }
                let result: Record<string, unknown> = { ok: true, op: cmd.op };
                try {
                    if (cmd.op === "snapshot") {
                        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a.sb-item"));
                        const hrefs = links.map((a) => a.getAttribute("href") ?? "");
                        const physician = hrefs.some((h) => h === "/statistics" || h.endsWith("/statistics"));
                        result = {
                            ok: true,
                            op: "snapshot",
                            path: window.location.pathname,
                            title: document.title,
                            login:
                                window.location.pathname.startsWith("/login") ||
                                Boolean(loginEmailInput()),
                            role: physician ? "physician" : links.length ? "reception" : null,
                            sidebar: links.map((a) => ({
                                href: a.getAttribute("href"),
                                label: a.getAttribute("aria-label") || a.textContent?.trim(),
                            })),
                        };
                    } else if (cmd.op === "setLocale" && cmd.locale) {
                        useLocale.getState().setLocale(cmd.locale);
                    } else if (cmd.op === "setTheme" && cmd.theme) {
                        const cur = loadClientSettings();
                        const a = cur.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                        const next = mergeClientSettingsPatch(cur, { appearance: { ...a, colorScheme: cmd.theme } });
                        saveClientSettings(next);
                        applyAppearanceFromSettings(next);
                    } else if (cmd.op === "fillLogin") {
                        if (!loginEmailInput()) {
                            go("/login", true);
                        }
                        for (let i = 0; i < 20 && !loginEmailInput(); i++) {
                            await delay(200);
                        }
                        const email = loginEmailInput();
                        const password = loginPasswordInput();
                        if (email && cmd.email) setNativeValue(email, cmd.email);
                        if (password && cmd.password) setNativeValue(password, cmd.password);
                        result.ok = Boolean(email && password);
                    } else if (cmd.op === "submitLogin") {
                        const form =
                            document.querySelector<HTMLFormElement>("form.login-form") ??
                            loginPasswordInput()?.form ??
                            null;
                        if (form) {
                            form.requestSubmit();
                            result.ok = true;
                        } else {
                            const btn = document.querySelector<HTMLElement>("form.login-form button[type='submit']");
                            btn?.click();
                            result.ok = Boolean(btn);
                        }
                    } else if (cmd.op === "clickSidebar" && cmd.href) {
                        const want = cmd.href;
                        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a.sb-item"));
                        const hit = links.find((a) => {
                            const h = a.getAttribute("href") ?? "";
                            return h === want || h.endsWith(want);
                        });
                        if (hit) hit.click();
                        else go(want);
                    } else if (cmd.op === "clickText" && cmd.text) {
                        result.ok = clickMatchingButton(cmd.text);
                    } else if (cmd.op === "clickSelector" && cmd.selector) {
                        const el = document.querySelector<HTMLElement>(cmd.selector);
                        el?.click();
                        result.ok = Boolean(el);
                    } else if (cmd.op === "logout" || cmd.op === "forceLogout") {
                        clickLogoutConfirm();
                        try {
                            await Promise.race([
                                logout(),
                                delay(4000).then(() => {
                                    throw new Error("logout timeout");
                                }),
                            ]);
                        } catch {
                            /* already signed out or hung work-time end */
                        }
                        try {
                            useAuthStore.getState().clear();
                        } catch {
                            /* store unavailable */
                        }
                        go("/login", true);
                        await delay(500);
                        clickLogoutConfirm();
                        result.ok =
                            Boolean(loginEmailInput()) || window.location.pathname.startsWith("/login");
                    } else if (cmd.op === "confirmLogout") {
                        result.ok = clickLogoutConfirm();
                    }
                } catch (e) {
                    result = { ok: false, error: String(e) };
                }
                await fetch(`${BRIDGE}/ack`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: cmd.id, ...result }),
                });
            } catch {
                /* bridge down */
            } finally {
                inFlight = false;
            }
        })();
    }, 350);
}

export function DevCaptureNavBinder() {
    const navigate = useNavigate();
    useEffect(() => {
        window.__medocCaptureNavigate = (href, opts) => {
            navigate(href, { replace: opts?.replace });
        };
        return () => {
            delete window.__medocCaptureNavigate;
        };
    }, [navigate]);
    return null;
}
