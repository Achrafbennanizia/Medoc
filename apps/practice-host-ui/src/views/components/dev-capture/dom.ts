/** DOM helpers for the dev capture bridge: fill fields like a user, click by text, route changes. */

type CaptureNav = (href: string, opts?: { replace?: boolean }) => void;

declare global {
    interface Window {
        __medocCaptureNavigate?: CaptureNav;
    }
}

export const px = (n: number) => Math.round(n);

export function delay(ms: number): Promise<void> {
    return new Promise((r) => window.setTimeout(r, ms));
}

/** Sets an input's value so React's onChange fires (bypasses React's value tracker). */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    const tracker = (el as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
    tracker?.setValue("");
    setter?.call(el, value);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Clicks the button / menu item / sidebar link whose text matches exactly, else the first containing it. */
export function clickMatchingButton(text: string): boolean {
    const want = text.trim().toLowerCase();
    const nodes = Array.from(document.querySelectorAll("button, [role='menuitem'], a.sb-item"));
    const label = (n: Element) => (n.textContent ?? "").trim().toLowerCase();
    const hit = nodes.find((n) => label(n) === want) ?? nodes.find((n) => label(n).includes(want));
    if (hit instanceof HTMLElement) hit.click();
    return hit instanceof HTMLElement;
}

export function clickLogoutConfirm(): boolean {
    const btn =
        document.querySelector<HTMLElement>(".ios-confirm-btn--destructive") ??
        document.querySelector<HTMLElement>(".modal--ios-confirm .ios-confirm-btn--primary");
    btn?.click();
    return Boolean(btn);
}

export function loginEmailInput(): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>("form.login-form input[type='email']") ?? document.querySelector<HTMLInputElement>("form.login-form #email");
}

export function loginPasswordInput(): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>("form.login-form input[type='password']") ?? document.querySelector<HTMLInputElement>("form.login-form #password");
}

export function sidebarLinks(): HTMLAnchorElement[] {
    return Array.from(document.querySelectorAll<HTMLAnchorElement>("a.sb-item"));
}

/** Route change: app navigate (bound by DevCaptureNavBinder), else a sidebar link, else history + popstate. */
export function go(href: string, replace = false): void {
    const nav = window.__medocCaptureNavigate;
    if (nav) return nav(href, { replace });
    const hit = sidebarLinks().find((a) => (a.getAttribute("href") ?? "") === href || (a.getAttribute("href") ?? "").endsWith(href));
    if (hit) return hit.click();
    window.history[replace ? "replaceState" : "pushState"](null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
}
