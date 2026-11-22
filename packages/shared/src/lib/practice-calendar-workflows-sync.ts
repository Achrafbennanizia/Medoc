/**
 * Calendar behaviour that used to live only in localStorage:
 * default view, default duration, confirm mode, emergency toolbar, card hover.
 * Published to `practice.calendar-workflows.v1` so master and replica share it.
 */

import { getAppKvRaw, setAppKvRaw } from "@/systems/practice-host/controllers/app-kv.controller";
import {
    applyAppearanceFromSettings,
    loadClientSettings,
    mergeClientSettingsPatch,
    normalizeAppointmentCalendarView,
    normalizeAppointmentCardHoverScale,
    normalizeAppointmentConfirmMode,
    onClientSettingsSaved,
    type AppointmentCalendarView,
    type AppointmentCardHoverScaleId,
    type AppointmentConfirmMode,
    type ClientSettingsV1,
} from "@/lib/client-settings";

export const CALENDAR_WORKFLOWS_KV_KEY = "practice.calendar-workflows.v1";
export const CALENDAR_WORKFLOWS_CHANGED_EVENT = "medoc-calendar-workflows-changed";

export type CalendarWorkflows = {
    appointmentsDefaultView: AppointmentCalendarView;
    defaultAppointmentDurationMin: number;
    calendarEmergencyToolbarEnabled: boolean;
    appointmentConfirmMode: AppointmentConfirmMode;
    appointmentCardHoverScale: AppointmentCardHoverScaleId;
};

let nextPublishAt = 0;

/**
 * Last value this window and the shared key agreed on (three-way merge base). Kept across reloads so a
 * local change that has not reached the shared key yet is recognised as local — before, every refresh
 * compared only local vs shared and always took the shared copy, so unsent selections were reverted.
 */
const BASE_KEY = "medoc-calendar-workflows-base-v1";
function readBase(): string {
    try {
        return localStorage.getItem(BASE_KEY) ?? "";
    } catch {
        return "";
    }
}
function writeBase(json: string): void {
    try {
        localStorage.setItem(BASE_KEY, json);
    } catch {
        /* ignore */
    }
}

export function calendarWorkflowsOf(s: ClientSettingsV1): CalendarWorkflows {
    const w = s.workflows;
    const rawDuration = w?.defaultAppointmentDurationMin;
    const duration = typeof rawDuration === "number" && Number.isFinite(rawDuration) ? Math.round(rawDuration) : 30;
    return {
        appointmentsDefaultView: normalizeAppointmentCalendarView(w?.appointmentsDefaultView),
        defaultAppointmentDurationMin: Math.min(480, Math.max(5, duration)),
        calendarEmergencyToolbarEnabled: w?.calendarEmergencyToolbarEnabled === true,
        appointmentConfirmMode: normalizeAppointmentConfirmMode(w?.appointmentConfirmMode),
        appointmentCardHoverScale: normalizeAppointmentCardHoverScale(s.appearance?.appointmentCardHoverScale),
    };
}

function parseCalendarWorkflows(raw: string): CalendarWorkflows | null {
    try {
        const j = JSON.parse(raw) as Partial<CalendarWorkflows>;
        if (j == null || typeof j !== "object") return null;
        return calendarWorkflowsOf({
            version: 1,
            workflows: {
                appointmentsDefaultView: j.appointmentsDefaultView,
                defaultAppointmentDurationMin: j.defaultAppointmentDurationMin,
                calendarEmergencyToolbarEnabled: j.calendarEmergencyToolbarEnabled,
                appointmentConfirmMode: j.appointmentConfirmMode,
            },
            appearance: {
                darkSidebar: false,
                density: "cozy",
                appointmentCardHoverScale: j.appointmentCardHoverScale,
            },
        });
    } catch {
        return null;
    }
}

async function publishCalendarWorkflows(s: ClientSettingsV1): Promise<void> {
    const body = JSON.stringify(calendarWorkflowsOf(s));
    if (body === readBase() || Date.now() < nextPublishAt) return;
    try {
        await setAppKvRaw(CALENDAR_WORKFLOWS_KV_KEY, body);
        writeBase(body);
    } catch {
        // Not published (offline, or this role may not change shared settings): the local value stays;
        // the next refresh sees it as a pending local change and retries instead of reverting it.
        nextPublishAt = Date.now() + 15_000;
    }
}

/** What a refresh should do, given the local value, the shared value and the last agreed value. */
export function resolveCalendarWorkflowsMerge(local: string, remote: string, base: string): "none" | "adopt-remote" | "publish-local" {
    if (local === remote) return "none";
    // Never synced on this device: take the practice's shared value rather than pushing local defaults.
    if (!base) return "adopt-remote";
    // Local unchanged since the last agreement → the shared value is newer.
    if (local === base) return "adopt-remote";
    // Local changed (shared unchanged, or both changed): the user's selection on this device wins.
    return "publish-local";
}

onClientSettingsSaved((next) => {
    void publishCalendarWorkflows(next);
});

/** Pull the shared calendar workflows into this window. Publishes local ones when the key is empty. */
export async function mergeCalendarWorkflowsFromKv(): Promise<void> {
    let raw: string | null = null;
    try {
        raw = await getAppKvRaw(CALENDAR_WORKFLOWS_KV_KEY);
    } catch {
        return;
    }
    if (!raw?.trim()) {
        await publishCalendarWorkflows(loadClientSettings());
        return;
    }
    const remote = parseCalendarWorkflows(raw);
    if (!remote) return;
    const remoteJson = JSON.stringify(remote);
    const localJson = JSON.stringify(calendarWorkflowsOf(loadClientSettings()));
    const action = resolveCalendarWorkflowsMerge(localJson, remoteJson, readBase());
    if (action === "none") {
        writeBase(remoteJson);
        return;
    }
    if (action === "publish-local") {
        await publishCalendarWorkflows(loadClientSettings());
        return;
    }
    writeBase(remoteJson);
    const cur = loadClientSettings();
    const next = mergeClientSettingsPatch(cur, {
        workflows: {
            ...cur.workflows,
            appointmentsDefaultView: remote.appointmentsDefaultView,
            defaultAppointmentDurationMin: remote.defaultAppointmentDurationMin,
            calendarEmergencyToolbarEnabled: remote.calendarEmergencyToolbarEnabled,
            appointmentConfirmMode: remote.appointmentConfirmMode,
        },
        appearance: {
            ...cur.appearance,
            darkSidebar: cur.appearance?.darkSidebar ?? false,
            density: cur.appearance?.density ?? "cozy",
            appointmentCardHoverScale: remote.appointmentCardHoverScale,
        },
    });
    try {
        localStorage.setItem("medoc-client-settings-v1", JSON.stringify(next));
    } catch {
        return;
    }
    applyAppearanceFromSettings(next);
    window.dispatchEvent(new CustomEvent(CALENDAR_WORKFLOWS_CHANGED_EVENT));
    // Keep instance ui-prefs.json aligned (do not leave Appearance only in shared LS).
    void import("@/systems/practice-host/controllers/ui-prefs.controller").then((m) => {
        m.schedulePersistUiPrefs({ settings: next });
    });
}
