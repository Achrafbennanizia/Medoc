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

let lastPublishedJson = "";
let nextPublishAt = 0;

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
    if (body === lastPublishedJson || Date.now() < nextPublishAt) return;
    try {
        await setAppKvRaw(CALENDAR_WORKFLOWS_KV_KEY, body);
        lastPublishedJson = body;
    } catch {
        nextPublishAt = Date.now() + 15_000;
    }
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
    lastPublishedJson = remoteJson;
    const local = calendarWorkflowsOf(loadClientSettings());
    if (JSON.stringify(local) === remoteJson) return;
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
}
