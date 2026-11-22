/**
 * Notification delivery (Strategy per channel): native OS notification centre, in-app chime.
 *
 * - Desktop app: `@tauri-apps/plugin-notification` → macOS Notification Center / Windows Action Center /
 *   Linux libnotify, with the system sound. (The web `Notification` API does not reach the OS centre inside
 *   the macOS webview, which is why notifications looked "mute" before.)
 * - Browser / LAN web client: web `Notification` API when permitted.
 * - Sound: a short two-tone chime synthesised with Web Audio (no audio asset), louder pattern for critical.
 */
import type { Notice } from "./notice";
import { isTauriApp } from "@/lib/is-tauri-app";

let audioCtx: AudioContext | null = null;

function context(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx ??= new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => undefined);
    return audioCtx;
}

/** Play the notification chime. `volume` 0–1. Critical notices use a three-tone pattern. */
export function playNotificationChime(severity: Notice["severity"], volume = 0.6): void {
    const ctx = context();
    if (!ctx) return;
    const tones = severity === "critical" ? [880, 660, 880] : severity === "warning" ? [740, 988] : [988, 1318];
    const gainPeak = Math.max(0, Math.min(1, volume)) * 0.18;
    tones.forEach((freq, i) => {
        const t0 = ctx.currentTime + i * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.24);
    });
}

/** Ask once for OS permission (called when the user enables push in Settings and at first delivery). */
export async function ensureOsNotificationPermission(): Promise<boolean> {
    try {
        if (isTauriApp()) {
            const plugin = await import("@tauri-apps/plugin-notification");
            if (await plugin.isPermissionGranted()) return true;
            return (await plugin.requestPermission()) === "granted";
        }
        if (typeof window.Notification === "undefined") return false;
        if (window.Notification.permission === "granted") return true;
        if (window.Notification.permission === "denied") return false;
        return (await window.Notification.requestPermission()) === "granted";
    } catch {
        return false;
    }
}

/** Show a notice in the operating system's notification centre (with sound when `withSound`). */
export async function sendOsNotification(n: Notice, withSound: boolean): Promise<void> {
    if (!(await ensureOsNotificationPermission())) return;
    try {
        if (isTauriApp()) {
            const plugin = await import("@tauri-apps/plugin-notification");
            plugin.sendNotification({ title: n.title, body: n.body, ...(withSound ? { sound: "default" } : {}) });
            return;
        }
        new window.Notification(n.title, { body: n.body, tag: n.id, silent: !withSound });
    } catch {
        /* platform without notification support */
    }
}

/** Whether OS notifications can work here at all (Settings shows a hint otherwise). */
export function osNotificationsSupported(): boolean {
    return isTauriApp() || (typeof window !== "undefined" && typeof window.Notification !== "undefined");
}
