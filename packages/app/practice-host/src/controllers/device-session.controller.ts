/**
 * Device sessions — IPC micro-service (auth / SQLite `device_session`).
 */
import { practiceSystem } from "../adapters/practice-transport";

export type DeviceSessionRow = {
    id: string;
    user_id: string;
    device_label: string;
    user_agent: string | null;
    created_at: string;
    last_seen_at: string;
    is_current: boolean;
    is_trusted: boolean;
    trusted_at: string | null;
    is_suspected: boolean;
    suspected_reasons: string[];
};

export type DeviceSessionAuditEntry = {
    id: string;
    action: string;
    created_at: string;
    details: string | null;
};

export type DeviceSessionInvestigation = {
    session: DeviceSessionRow;
    active_session_count: number;
    same_device_label_count: number;
    recent_logins: DeviceSessionAuditEntry[];
};

export async function listMyDeviceSessions(): Promise<DeviceSessionRow[]> {
    return practiceSystem.invoke<DeviceSessionRow[]>("list_my_device_sessions");
}

export async function revokeMyOtherDeviceSessions(): Promise<number> {
    return practiceSystem.invoke<number>("revoke_my_other_device_sessions");
}

export async function investigateMyDeviceSession(sessionId: string): Promise<DeviceSessionInvestigation> {
    return practiceSystem.invoke<DeviceSessionInvestigation>("investigate_my_device_session", {
        sessionId,
    });
}

export async function revokeMyDeviceSession(sessionId: string): Promise<void> {
    await practiceSystem.invoke("revoke_my_device_session", { sessionId });
}

export async function setMyDeviceSessionTrusted(
    sessionId: string,
    trusted: boolean,
): Promise<DeviceSessionRow> {
    return practiceSystem.invoke<DeviceSessionRow>("set_my_device_session_trusted", {
        sessionId,
        trusted,
    });
}
