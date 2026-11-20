/**
 * Notification sources. Each one adapts a domain (backend inbox, tasks, schedule, stock, device security)
 * to {@link Notice}. Failing sources are isolated by the center — one broken source never empties the list.
 */
import { parseInstant, clockNow, wallClockToDate } from "@/lib/practice-clock";
import { displayPracticeTaskTitle } from "@/lib/finance-order-labels";
import { statusIsOpen } from "@/lib/status/status-registry";
import {
    listInAppNotifications,
    markAllInAppNotificationsRead,
    markInAppNotificationRead,
} from "../controllers/in-app-notification.controller";
import { listPracticeTasksForMe } from "../controllers/practice-task.controller";
import { listUpcomingAppointments } from "../controllers/integration.controller";
import { listMyDeviceSessions } from "../controllers/device-session.controller";
import { listProducts } from "../controllers/product.controller";
import type { Notice, NoticeCategory, NoticeSeverity, NoticeSource } from "./notice";

/** Minutes ahead for "appointment starts soon". */
export const APPOINTMENT_REMINDER_LEAD_MIN = 30;

function inboxCategory(kind: string): NoticeCategory {
    const k = kind.toLowerCase();
    if (k.startsWith("practice_task")) return "task";
    if (k.includes("appointment") || k.includes("plan_hint")) return "appointment";
    if (k.includes("chart") || k.includes("prescription")) return "clinical";
    if (k.includes("order") || k.includes("inventory") || k.includes("stock")) return "inventory";
    if (k.includes("device") || k.includes("security") || k.includes("login")) return "security";
    return "system";
}

function inboxSeverity(kind: string): NoticeSeverity {
    const k = kind.toUpperCase();
    if (k.endsWith("_BACK") || k.includes("DECLINED") || k.includes("SUSPECT")) return "warning";
    return "info";
}

function inboxHref(kind: string, payload: string | null): string | undefined {
    let p: Record<string, unknown> = {};
    try {
        p = payload ? (JSON.parse(payload) as Record<string, unknown>) : {};
    } catch {
        /* ignore */
    }
    const taskId = typeof p.taskId === "string" ? p.taskId : typeof p.task_id === "string" ? p.task_id : undefined;
    if (taskId || kind.toUpperCase().startsWith("PRACTICE_TASK")) {
        return taskId ? `/tickets?task=${encodeURIComponent(taskId)}` : "/tickets";
    }
    if (typeof p.patient_id === "string") return `/patients/${encodeURIComponent(p.patient_id)}`;
    if (typeof p.appointment_id === "string") return "/appointments";
    if (kind.toLowerCase().includes("chart")) return "/charts-to-validate";
    return undefined;
}

export const inboxSource: NoticeSource = {
    id: "inbox",
    enabled: () => true,
    async load() {
        const rows = await listInAppNotifications();
        return rows.map(
            (n): Notice => ({
                id: `inbox:${n.id}`,
                source: "inbox",
                category: inboxCategory(n.kind),
                severity: inboxSeverity(n.kind),
                title: n.title,
                body: n.body,
                at: parseInstant(n.created_at) ?? clockNow(),
                unread: !n.read_at,
                href: inboxHref(n.kind, n.payload_json),
            }),
        );
    },
    async markRead(notice) {
        await markInAppNotificationRead(notice.id.replace(/^inbox:/, ""));
    },
    async markAllRead() {
        await markAllInAppNotificationsRead();
    },
};

/** Actionable tasks for me (status-keyed id: a task that changes status notifies again). */
export const taskSource: NoticeSource = {
    id: "task",
    enabled: (ctx) => ctx.role === "PHYSICIAN" || ctx.role === "RECEPTION",
    async load(ctx) {
        const tasks = await listPracticeTasksForMe();
        return tasks
            .filter((task) => {
                if (!statusIsOpen("practice_task", task.status)) return false;
                if (task.status === "DONE_RECEPTION") return task.created_by === ctx.userId;
                return task.created_by !== ctx.userId || task.assignee_user_id === ctx.userId;
            })
            .slice(0, 20)
            .map((task): Notice => {
                const id = `task:${task.id}:${task.status}`;
                const back = task.status === "BACK";
                return {
                    id,
                    source: "task",
                    category: "task",
                    severity: back ? "warning" : "info",
                    title: displayPracticeTaskTitle(task.title, ctx.t),
                    body: back
                        ? ctx.t("app.notifications.task_returned")
                        : task.status === "DONE_RECEPTION"
                          ? ctx.t("app.notifications.task_needs_validation")
                          : ctx.t("app.notifications.task_open"),
                    at: parseInstant(task.updated_at) ?? parseInstant(task.created_at) ?? clockNow(),
                    unread: !ctx.isLocallyRead(id),
                    href: `/tickets?task=${encodeURIComponent(task.id)}`,
                };
            });
    },
};

/** Appointments starting within {@link APPOINTMENT_REMINDER_LEAD_MIN} minutes (mine for physicians). */
export const appointmentReminderSource: NoticeSource = {
    id: "appointment",
    enabled: (ctx) => ctx.role === "PHYSICIAN" || ctx.role === "RECEPTION",
    async load(ctx) {
        const rows = await listUpcomingAppointments(APPOINTMENT_REMINDER_LEAD_MIN);
        return rows
            .filter((r) => ctx.role !== "PHYSICIAN" || r.physician_id === ctx.userId)
            .map((r): Notice => {
                const id = `appt:${r.appointment_id}:${r.date}T${r.time}`;
                return {
                    id,
                    source: "appointment",
                    category: "appointment",
                    severity: r.minutes_until <= 10 ? "warning" : "info",
                    title: ctx.tp("app.notifications.appointment_soon", { name: r.patient_name, minutes: r.minutes_until }),
                    body: `${r.date} · ${r.time.slice(0, 5)}`,
                    at: wallClockToDate(r.date, r.time) ?? clockNow(),
                    unread: !ctx.isLocallyRead(id),
                    href: "/appointments",
                };
            });
    },
};

/** Suspicious sign-ins on my account (critical: possible account misuse). */
export const deviceSecuritySource: NoticeSource = {
    id: "security",
    enabled: () => true,
    async load(ctx) {
        const sessions = await listMyDeviceSessions();
        return sessions
            .filter((s) => s.is_suspected && !s.is_current)
            .map((s): Notice => {
                const id = `device:${s.id}`;
                return {
                    id,
                    source: "security",
                    category: "security",
                    severity: "critical",
                    title: ctx.t("app.notifications.device_suspected"),
                    body: (s.device_label ?? "").trim() || ctx.t("settings.device_sessions.default_device"),
                    at: parseInstant(s.last_seen_at) ?? clockNow(),
                    unread: !ctx.isLocallyRead(id),
                    href: "/settings?tab=security",
                };
            });
    },
};

/** Products at or below minimum stock (id carries the level: notifies again when it drops further). */
export const lowStockSource: NoticeSource = {
    id: "inventory",
    enabled: (ctx) => ctx.role === "PHYSICIAN" || ctx.role === "RECEPTION",
    async load(ctx) {
        const products = await listProducts();
        return products
            .filter((p) => p.min_stock > 0 && p.stock <= p.min_stock)
            .slice(0, 10)
            .map((p): Notice => {
                const id = `stock:${p.id}:${p.stock}`;
                return {
                    id,
                    source: "inventory",
                    category: "inventory",
                    severity: p.stock <= 0 ? "critical" : "warning",
                    title: ctx.tp("app.notifications.low_stock", { name: p.name }),
                    body: ctx.tp("app.notifications.low_stock_detail", { stock: p.stock, min: p.min_stock }),
                    at: parseInstant(p.updated_at) ?? clockNow(),
                    unread: !ctx.isLocallyRead(id),
                    href: "/products",
                };
            });
    },
};

export const DEFAULT_NOTICE_SOURCES: readonly NoticeSource[] = [
    inboxSource,
    taskSource,
    appointmentReminderSource,
    deviceSecuritySource,
    lowStockSource,
];
