import {
    APPOINTMENT_OUTSIDE_HOURS_KIND,
    APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND,
    outsideHoursItemCopy,
} from "./appointment-hours-compliance";
import { displayPracticeTaskTitle, type PracticeTaskCopy } from "./finance-order-labels";
import { formatDate } from "./utils";

type TFn = (key: string) => string;
type TParamsFn = (key: string, params: Record<string, string | number>) => string;

export type InAppNotificationDisplayInput = {
    kind: string;
    title: string;
    body: string;
    payload_json: string | null;
};

function parsePayload(raw: string | null): Record<string, unknown> {
    if (!raw?.trim()) return {};
    try {
        const v = JSON.parse(raw) as unknown;
        return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function str(v: unknown): string {
    return typeof v === "string" ? v.trim() : "";
}

function taskCopy(payload: Record<string, unknown>): PracticeTaskCopy {
    return {
        kind: str(payload.kind),
        title: str(payload.task_title) || str(payload.taskTitle),
        service_name: str(payload.service_name) || str(payload.serviceName),
    };
}

function taskLabel(payload: Record<string, unknown>, fallbackTitle: string, t: TFn): string {
    const patient = str(payload.patient_name) || str(payload.patientName);
    if (patient) return patient;
    const copy = taskCopy(payload);
    const taskTitle = (copy.title ?? "").trim();
    if (taskTitle || copy.kind === "BILLING") return displayPracticeTaskTitle(taskTitle, t, copy);
    const fromStored = /:\s*(.+)$/.exec(fallbackTitle)?.[1]?.trim();
    if (fromStored) return displayPracticeTaskTitle(fromStored, t);
    return displayPracticeTaskTitle(fallbackTitle, t) || fallbackTitle;
}

function taskNoticeBody(body: string, payload: Record<string, unknown>, t: TFn): string {
    const copy = taskCopy(payload);
    if (copy.kind !== "BILLING") return body;
    return displayPracticeTaskTitle(body, t, copy);
}

const SEED_KINDS = new Set(["PRACTICE_TASK", "TICKET", "APPOINTMENT", "STOCK", "SYSTEM"]);

/**
 * Localize in-app notification title/body for the active UI locale.
 * Structured payloads are preferred; stored English/German text is only a fallback.
 */
export function localizeInAppNotification(
    n: InAppNotificationDisplayInput,
    t: TFn,
    tp: TParamsFn,
): { title: string; sub: string } {
    const payload = parsePayload(n.payload_json);
    const kind = n.kind.trim();

    if (kind === APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND) {
        const count = typeof payload.count === "number" ? payload.count : undefined;
        return {
            title:
                count != null
                    ? tp("app.notifications.outside_hours_summary_title", { count })
                    : n.title,
            sub: t("app.notifications.outside_hours_summary_body"),
        };
    }

    if (kind === APPOINTMENT_OUTSIDE_HOURS_KIND) {
        const date = str(payload.date);
        const timeRaw = str(payload.time);
        const patient =
            str(payload.patient_name)
            || /:\s*(.+)$/.exec(n.title)?.[1]?.trim()
            || "";
        if (date && timeRaw) {
            const copy = outsideHoursItemCopy(patient, date, timeRaw, str(payload.reason), t, tp);
            return {
                title: patient ? copy.title : n.title,
                sub: copy.body,
            };
        }
    }

    if (kind === "PRACTICE_TASK_ASSIGNED") {
        const label = taskLabel(payload, n.title, t);
        const body = taskNoticeBody(n.body.trim(), payload, t);
        return {
            title: tp("app.notifications.task_assigned_title", { label }),
            sub: body || t("app.notifications.task_assigned_body_fallback"),
        };
    }

    if (kind === "PRACTICE_TASK_DONE") {
        const label = taskLabel(payload, n.title, t);
        const body = n.body.trim();
        const looksEnglishFallback = /^Reception marked the task as completed\.?$/i.test(body);
        return {
            title: tp("app.notifications.task_done_title", { label }),
            sub: !body || looksEnglishFallback
                ? t("app.notifications.task_done_body_fallback")
                : taskNoticeBody(body, payload, t),
        };
    }

    if (kind === "PRACTICE_TASK_BACK") {
        const label = taskLabel(payload, n.title, t);
        const body = n.body.trim();
        const looksEnglishFallback = /^Please process again\.?$/i.test(body);
        return {
            title: tp("app.notifications.task_back_title", { label }),
            sub: !body || looksEnglishFallback
                ? t("app.notifications.task_back_body_fallback")
                : taskNoticeBody(body, payload, t),
        };
    }

    if (kind === "plan_hint_fulfilled") {
        const patient =
            str(payload.patient_name)
            || str(payload.patientName)
            || n.body.split(":")[0]?.trim()
            || "";
        const date = str(payload.date);
        const time = str(payload.time);
        if (patient && date && time) {
            return {
                title: t("app.notifications.plan_hint_title"),
                sub: tp("app.notifications.plan_hint_body", {
                    patient,
                    date: formatDate(date),
                    time: time.length >= 5 ? time.slice(0, 5) : time,
                }),
            };
        }
        return {
            title: t("app.notifications.plan_hint_title"),
            sub: n.body || t("app.notifications.plan_hint_title"),
        };
    }

    if (kind === "CHART_FORWARD") {
        const from = str(payload.fromName) || str(payload.from_name) || "—";
        const patient = str(payload.patient_name) || str(payload.patientName) || "—";
        const note = str(payload.note);
        return {
            title: t("app.notifications.chart_forward_title"),
            sub: note
                ? tp("app.notifications.chart_forward_body_note", { from, patient, note })
                : tp("app.notifications.chart_forward_body", { from, patient }),
        };
    }

    if (kind === "PRACTICE_TICKET") {
        const patient =
            str(payload.patient_name)
            || str(payload.patientName)
            || /:\s*(.+)$/.exec(n.title)?.[1]?.trim()
            || n.title;
        return {
            title: tp("app.notifications.ticket_title", { patient }),
            sub: n.body.trim() || tp("app.notifications.ticket_title", { patient }),
        };
    }

    if (SEED_KINDS.has(kind)) {
        const titleKey = `app.notifications.seed.${kind}.title`;
        const bodyKey = `app.notifications.seed.${kind}.body`;
        const title = t(titleKey);
        const body = t(bodyKey);
        if (title !== titleKey && body !== bodyKey) {
            return { title, sub: body };
        }
    }

    return { title: n.title, sub: n.body };
}
