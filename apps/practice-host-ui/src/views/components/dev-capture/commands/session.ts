/** Sign-in / sign-out and "where am I" commands. */
import { useAuthStore } from "@/models/store/auth-store";
import { logout } from "@/systems/practice-host/controllers/auth.controller";
import { clickLogoutConfirm, delay, go, loginEmailInput, loginPasswordInput, setNativeValue, sidebarLinks } from "../dom";
import type { CaptureCommandGroup, CaptureResult } from "../types";

async function signOut(): Promise<CaptureResult> {
    clickLogoutConfirm();
    try {
        await Promise.race([logout(), delay(4000).then(() => Promise.reject(new Error("logout timeout")))]);
    } catch {
        /* already signed out, or a hung work-time end */
    }
    try {
        useAuthStore.getState().clear();
    } catch {
        /* store unavailable */
    }
    go("/login", true);
    await delay(500);
    clickLogoutConfirm();
    return { ok: Boolean(loginEmailInput()) || window.location.pathname.startsWith("/login") };
}

export const sessionCommands: CaptureCommandGroup = {
    snapshot: () => {
        const links = sidebarLinks();
        const hrefs = links.map((a) => a.getAttribute("href") ?? "");
        const physician = hrefs.some((h) => h === "/statistics" || h.endsWith("/statistics"));
        return {
            path: window.location.pathname,
            title: document.title,
            login: window.location.pathname.startsWith("/login") || Boolean(loginEmailInput()),
            role: physician ? "physician" : links.length ? "reception" : null,
            sidebar: links.map((a) => ({ href: a.getAttribute("href"), label: a.getAttribute("aria-label") || a.textContent?.trim() })),
        };
    },
    fillLogin: async (cmd) => {
        if (!loginEmailInput()) go("/login", true);
        for (let i = 0; i < 20 && !loginEmailInput(); i++) await delay(200);
        const email = loginEmailInput();
        const password = loginPasswordInput();
        if (email && cmd.email) setNativeValue(email, cmd.email);
        if (password && cmd.password) setNativeValue(password, cmd.password);
        return { ok: Boolean(email && password) };
    },
    submitLogin: () => {
        const form = document.querySelector<HTMLFormElement>("form.login-form") ?? loginPasswordInput()?.form ?? null;
        if (form) {
            form.requestSubmit();
            return { ok: true };
        }
        const btn = document.querySelector<HTMLElement>("form.login-form button[type='submit']");
        btn?.click();
        return { ok: Boolean(btn) };
    },
    logout: signOut,
    forceLogout: signOut,
    confirmLogout: () => ({ ok: clickLogoutConfirm() }),
};
