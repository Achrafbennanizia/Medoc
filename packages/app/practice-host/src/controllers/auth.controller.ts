import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import { useAuthStore } from "@/models/store/auth-store";
import type { Session } from "@/models/types";

export type LoginOpts = {
    device_label?: string;
    user_agent?: string;
    totp_code?: string;
};

export async function login(
    email: string,
    passwort: string,
    opts?: LoginOpts,
): Promise<Session> {
    const session = await practiceSystem.invoke<Session>("login", {
        email,
        passwort,
        totp_code: opts?.totp_code ?? null,
        device_label: opts?.device_label ?? null,
        user_agent: opts?.user_agent ?? (typeof navigator !== "undefined" ? navigator.userAgent : null),
    });
    useAuthStore.getState().setSession(session);
    try {
        const { workTimeGetAutoRecordOnLogin, workTimeReconcileOnLogin, workTimeStart } =
            await import("@/systems/practice-host/controllers/work-time.controller");
        await workTimeReconcileOnLogin();
        if (await workTimeGetAutoRecordOnLogin()) {
            await workTimeStart(true);
        }
    } catch {
        /* auto-record optional */
    }
    return session;
}

export async function logout(): Promise<void> {
    try {
        const { workTimeEnd } = await import("@/systems/practice-host/controllers/work-time.controller");
        await workTimeEnd();
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
