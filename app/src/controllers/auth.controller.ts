import { tauriInvoke } from "../services/tauri.service";
import { useAuthStore } from "../models/store/auth-store";
import type { Session } from "../models/types";

export async function login(email: string, passwort: string): Promise<Session> {
    const session = await tauriInvoke<Session>("login", { email, passwort });
    useAuthStore.getState().setSession(session);
    return session;
}

export async function logout(): Promise<void> {
    await tauriInvoke("logout");
    useAuthStore.getState().clear();
}

export async function checkSession(): Promise<Session | null> {
    const session = await tauriInvoke<Session | null>("get_session");
    useAuthStore.getState().setSession(session);
    return session;
}

/// Refresh the session's last-activity timestamp so the idle timeout resets.
export async function touchSession(): Promise<boolean> {
    return tauriInvoke<boolean>("touch_session");
}
