import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import { useAuthStore } from "@/models/store/auth-store";
import type { Session } from "@/models/types";

export type LoginOpts = {
    device_label?: string;
    user_agent?: string;
    /** TODO(deferred-security): 2FA unwired — IPC still accepts null. */
};

export async function login(
    email: string,
    password: string,
    opts?: LoginOpts,
): Promise<Session> {
    const session = await practiceSystem.invoke<Session>("login", {
        email,
        password,
        totp_code: null,
        device_label: opts?.device_label ?? null,
        user_agent: opts?.user_agent ?? (typeof navigator !== "undefined" ? navigator.userAgent : null),
    });
    useAuthStore.getState().setSession(session);
    try {
        const { workTimeGetActiveSession, workTimeGetPreference, workTimeReconcileOnLogin, workTimeResume, workTimeStart } =
            await import("@/systems/practice-host/controllers/work-time.controller");
        await workTimeReconcileOnLogin();
        const active = await workTimeGetActiveSession();
        if (active?.session.staffId === session.user_id && active.session.status === "PAUSED") {
            await workTimeResume();
        } else if (!active) {
            const pref = await workTimeGetPreference();
            if (pref.autoRecordOnLogin) {
                await workTimeStart(true);
            }
        }
    } catch {
        /* auto-record optional */
    }
    return session;
}

export async function logout(): Promise<void> {
    try {
        const { workTimeGetActiveSession, workTimeGetPreference, workTimePause } =
            await import("@/systems/practice-host/controllers/work-time.controller");
        const pref = await workTimeGetPreference();
        if (pref.autoRecordOnLogout) {
            const active = await workTimeGetActiveSession();
            const mine = active?.session.staffId === useAuthStore.getState().session?.user_id;
            if (mine && active?.session.status === "RUNNING") {
                await workTimePause();
            }
        }
    } catch {
        /* no open session */
    }
    await practiceSystem.invoke("logout");
    useAuthStore.getState().clear();
}

export async function checkSession(): Promise<Session | null> {
    const session = await practiceSystem.invoke<Session | null>("get_session");
    useAuthStore.getState().setSession(session);
    return session;
}

/// Refresh the session's last-activity timestamp so the idle timeout resets.
export async function touchSession(): Promise<boolean> {
    return practiceSystem.invoke<boolean>("touch_session");
}

/** Post-login landing path: RECEPTION → work-time page; others → dashboard. */
export async function postLoginPath(session: Session): Promise<string> {
    if (session.role === "RECEPTION") return "/staff/work-time";
    return "/";
}
