import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { parseDbUtc } from "@/lib/utils";
import { useToastStore } from "./ui/toast-store";
import {
    CheckIcon,
    ClipboardIcon,
    PackageIcon,
    PillIcon,
    SparkleIcon,
    ChevronRightIcon,
    CalendarIcon,
} from "@/lib/icons";
import {
    APPOINTMENT_OUTSIDE_HOURS_KIND,
    APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND,
} from "@/lib/appointment-hours-compliance";
import { localizeInAppNotification } from "@/lib/in-app-notification-display";
import {
    listInAppNotifications,
    markAllInAppNotificationsRead,
    markInAppNotificationRead,
} from "@/systems/practice-host/controllers/in-app-notification.controller";
import {
    listPracticeTasksForMe,
    type PracticeTask,
} from "@/systems/practice-host/controllers/practice-task.controller";
import type { InAppNotification } from "@/models/types";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import { practiceTaskHeadline } from "@/lib/practice-task-display";
import { useAuthStore } from "@/models/store/auth-store";

type Tone = "orange" | "red" | "green" | "blue" | "grey";

type NotifRow = {
    id: string;
    title: string;
    sub: string;
    time: string;
    sortAt: string;
    tone: Tone;
    unread: boolean;
    Icon: FC<{ size?: number }>;
    raw: InAppNotification | null;
    taskId?: string;
};

const toneSoft: Record<Tone, string> = {
    orange: "var(--orange-soft)",
    red: "var(--red-soft)",
    green: "var(--green-soft)",
    blue: "var(--blue-soft)",
    grey: "rgba(0,0,0,0.06)",
};

const toneFg: Record<Tone, string> = {
    orange: "var(--orange)",
    red: "var(--red)",
    green: "var(--accent)",
    blue: "var(--blue)",
    grey: "var(--fg-3)",
};

function isTaskNotificationKind(kind: string): boolean {
    return (
        kind === "PRACTICE_TASK_ASSIGNED" ||
        kind === "PRACTICE_TASK_DONE" ||
        kind === "PRACTICE_TASK_BACK"
    );
}

function toneForKind(kind: string): Tone {
    if (kind === "plan_hint_fulfilled") return "green";
    if (kind === APPOINTMENT_OUTSIDE_HOURS_KIND || kind === APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND) {
        return "orange";
    }
    if (kind === "PRACTICE_TASK_BACK" || kind === "PRACTICE_TASK" || kind === "PRACTICE_TASK_ASSIGNED") {
        return "orange";
    }
    if (kind === "PRACTICE_TASK_DONE" || kind === "CHART_FORWARD" || kind === "PRACTICE_TICKET" || kind === "TICKET") {
        return "blue";
    }
    if (kind === "STOCK" || kind.includes("inventory") || kind.includes("order")) return "red";
    if (kind.includes("prescription") || kind.includes("pill")) return "orange";
    return "blue";
}

function iconForKind(kind: string): FC<{ size?: number }> {
    if (kind === "plan_hint_fulfilled") return CheckIcon;
    if (
        kind === APPOINTMENT_OUTSIDE_HOURS_KIND
        || kind === APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND
        || kind === "APPOINTMENT"
    ) {
        return CalendarIcon;
    }
    if (isTaskNotificationKind(kind) || kind === "PRACTICE_TASK" || kind === "PRACTICE_TICKET" || kind === "TICKET" || kind === "CHART_FORWARD") {
        return ClipboardIcon;
    }
    if (kind === "STOCK" || kind.includes("inventory") || kind.includes("order")) return PackageIcon;
    if (kind.includes("prescription") || kind.includes("pill")) return PillIcon;
    return SparkleIcon;
}

function formatNotifTime(raw: string, dateFnsLocale: ReturnType<typeof useDateFnsLocale>): string {
    const d = parseDbUtc(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return formatDistanceToNow(d, { addSuffix: true, locale: dateFnsLocale });
}

function sortKeyMs(iso: string): number {
    const d = parseDbUtc(iso);
    const t = d.getTime();
    return Number.isNaN(t) ? 0 : t;
}

function taskIdFromPayload(payloadJson: string | null | undefined): string | undefined {
    if (!payloadJson) return undefined;
    try {
        const p = JSON.parse(payloadJson) as { taskId?: string };
        return typeof p.taskId === "string" && p.taskId ? p.taskId : undefined;
    } catch {
        return undefined;
    }
}

function dismissedTasksStorageKey(userId: string): string {
    return `medoc-notif-dismissed-tasks:${userId}`;
}

function loadDismissedTaskIds(userId: string | undefined): Set<string> {
    if (!userId || typeof window === "undefined") return new Set();
    try {
        const raw = sessionStorage.getItem(dismissedTasksStorageKey(userId));
        if (!raw) return new Set();
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
    } catch {
        return new Set();
    }
}

function persistDismissedTaskIds(userId: string | undefined, ids: Set<string>): void {
    if (!userId || typeof window === "undefined") return;
    try {
        sessionStorage.setItem(dismissedTasksStorageKey(userId), JSON.stringify([...ids]));
    } catch {
        /* ignore quota / private mode */
    }
}

function mapToRows(
    items: InAppNotification[],
    dateFnsLocale: ReturnType<typeof useDateFnsLocale>,
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
): NotifRow[] {
    return items.map((n) => {
        const taskId = taskIdFromPayload(n.payload_json);
        const copy = localizeInAppNotification(n, t, tp);
        return {
            id: n.id,
            title: copy.title,
            sub: copy.sub,
            time: formatNotifTime(n.created_at, dateFnsLocale),
            sortAt: n.created_at,
            tone: toneForKind(n.kind),
            unread: !n.read_at,
            Icon: iconForKind(n.kind),
            raw: n,
            taskId,
        };
    });
}

function actionableTask(task: PracticeTask, role: string | undefined): boolean {
    if (task.status === "OPEN" || task.status === "IN_PROGRESS" || task.status === "BACK") {
        return true;
    }
    // Physician validates reception-completed work
    return role === "PHYSICIAN" && task.status === "DONE_RECEPTION";
}

function taskRows(
    tasks: PracticeTask[],
    role: string | undefined,
    t: (key: string) => string,
    dateFnsLocale: ReturnType<typeof useDateFnsLocale>,
    knownTaskIds: Set<string>,
): NotifRow[] {
    return tasks
        .filter((task) => actionableTask(task, role) && !knownTaskIds.has(task.id))
        .slice(0, 12)
        .map((task) => {
            const sortAt = task.updated_at || task.created_at;
            return {
                id: `task:${task.id}`,
                title: practiceTaskHeadline(task, t),
                sub:
                    task.status === "BACK"
                        ? t("app.notifications.task_returned")
                        : task.status === "DONE_RECEPTION"
                          ? t("app.notifications.task_needs_validation")
                          : t("app.notifications.task_open"),
                time: formatNotifTime(sortAt, dateFnsLocale),
                sortAt,
                tone: task.status === "BACK" || task.status === "OPEN" ? "orange" : "blue",
                unread: true,
                Icon: ClipboardIcon,
                raw: null,
                taskId: task.id,
            };
        });
}

export function NotificationsPopover({
    onClose,
    onUnreadChanged,
}: {
    onClose: () => void;
    onUnreadChanged?: () => void;
}) {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const session = useAuthStore((s) => s.session);
    const role = session?.role;
    const canSeeTasks = role === "PHYSICIAN" || role === "RECEPTION";
    const userId = session?.user_id;
    const [items, setItems] = useState<NotifRow[]>([]);
    const [loadError, setLoadError] = useState(false);
    const [dismissedTaskIds, setDismissedTaskIds] = useState<Set<string>>(() => loadDismissedTaskIds(userId));

    useEffect(() => {
        setDismissedTaskIds(loadDismissedTaskIds(userId));
    }, [userId]);

    const rememberDismissedTask = useCallback(
        (taskId: string) => {
            setDismissedTaskIds((prev) => {
                if (prev.has(taskId)) return prev;
                const next = new Set(prev);
                next.add(taskId);
                persistDismissedTaskIds(userId, next);
                return next;
            });
        },
        [userId],
    );

    const reload = useCallback(async () => {
        try {
            setLoadError(false);
            const list = await listInAppNotifications();
            // Only unread rows stay in the list; reading removes them.
            const mapped = mapToRows(
                list.filter((n) => !n.read_at),
                dateFnsLocale,
                t,
                tp,
            );
            // Include read notifications too so opening a task once does not
            // resurrect a synthetic "open task" row a few minutes later.
            const known = new Set<string>();
            for (const n of list) {
                const tid = taskIdFromPayload(n.payload_json);
                if (tid) known.add(tid);
            }
            for (const id of dismissedTaskIds) known.add(id);
            let tasks: NotifRow[] = [];
            if (canSeeTasks) {
                try {
                    const open = await listPracticeTasksForMe();
                    tasks = taskRows(open, role, t, dateFnsLocale, known);
                } catch {
                    tasks = [];
                }
            }
            const merged = [...tasks, ...mapped].sort(
                (a, b) => sortKeyMs(b.sortAt) - sortKeyMs(a.sortAt),
            );
            setItems(merged);
        } catch {
            setLoadError(true);
            setItems([]);
        }
    }, [canSeeTasks, dateFnsLocale, dismissedTaskIds, role, t, tp]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const unreadN = useMemo(() => items.filter((x) => x.unread).length, [items]);
    const openTaskN = useMemo(
        () => items.filter((x) => x.id.startsWith("task:") || (x.taskId && x.unread)).length,
        [items],
    );

    const markAllRead = async () => {
        try {
            const syntheticTaskIds = items
                .map((x) => (x.id.startsWith("task:") && x.taskId ? x.taskId : null))
                .filter((id): id is string => Boolean(id));
            if (syntheticTaskIds.length > 0) {
                const next = new Set(dismissedTaskIds);
                for (const id of syntheticTaskIds) next.add(id);
                persistDismissedTaskIds(userId, next);
                setDismissedTaskIds(next);
            }
            await markAllInAppNotificationsRead();
            // Clear immediately; dismissedTaskIds update reloads without resurrecting tasks.
            setItems([]);
            onUnreadChanged?.();
            toast(t("app.notifications.marked_all"), "success");
        } catch {
            toast(t("common.error"), "error");
        }
    };

    const openTickets = (taskId?: string) => {
        onClose();
        navigate(taskId ? `/tickets?task=${encodeURIComponent(taskId)}` : "/tickets");
    };

    const onRowClick = async (row: NotifRow) => {
        if (row.raw && row.unread) {
            try {
                await markInAppNotificationRead(row.id);
                if (row.taskId) rememberDismissedTask(row.taskId);
                setItems((xs) => xs.filter((x) => x.id !== row.id));
                onUnreadChanged?.();
            } catch {
                /* still navigate */
            }
        } else if (!row.raw && row.taskId) {
            // Synthetic open-task rows are not DB notifications — remember dismiss
            // so they do not reappear on the next poll / reopen.
            rememberDismissedTask(row.taskId);
            setItems((xs) => xs.filter((x) => x.id !== row.id));
        }
        if (row.taskId || (row.raw && isTaskNotificationKind(row.raw.kind))) {
            openTickets(row.taskId);
            return;
        }
        try {
            if (row.raw?.payload_json) {
                const p = JSON.parse(row.raw.payload_json) as {
                    appointment_id?: string;
                    taskId?: string;
                };
                if (p.appointment_id) {
                    onClose();
                    navigate(`/appointments?focus=${encodeURIComponent(p.appointment_id)}`);
                    return;
                }
                if (
                    row.raw?.kind === APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND
                    || row.raw?.kind === APPOINTMENT_OUTSIDE_HOURS_KIND
                ) {
                    onClose();
                    navigate("/appointments");
                    return;
                }
                if (p.taskId) {
                    openTickets(p.taskId);
                }
            }
        } catch {
            /* ignore */
        }
    };

    return (
        <div
            className="notifications-popover"
            style={{
                width: 400,
                maxWidth: "min(400px, calc(100vw - 24px))",
            }}
        >
            <div className="row" style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t("app.notifications.title")}</div>
                {unreadN > 0 ? (
                    <span className="pill accent" style={{ marginInlineStart: 4 }}>
                        {unreadN} {t("common.new")}
                    </span>
                ) : null}
                <span className="spacer" style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => void markAllRead()}>
                    {t("app.notifications.mark_all_read")}
                </button>
            </div>
            <div style={{ maxHeight: 420, overflow: "auto" }}>
                {loadError ? (
                    <div style={{ padding: "20px 18px", fontSize: 13, color: "var(--fg-3)" }}>{t("common.error")}</div>
                ) : items.length === 0 ? (
                    <div style={{ padding: "20px 18px", fontSize: 13, color: "var(--fg-3)" }}>{t("app.notifications.empty")}</div>
                ) : (
                    items.map((n) => {
                        const Ic = n.Icon;
                        return (
                            <button
                                key={n.id}
                                type="button"
                                className="ios-row notifications-popover__row"
                                style={{
                                    width: "100%",
                                    textAlign: "start",
                                    font: "inherit",
                                    background: n.unread ? "rgba(14,160,126,0.04)" : "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 12,
                                    padding: "12px 16px",
                                    borderBottom: "1px solid var(--line)",
                                }}
                                onClick={() => void onRowClick(n)}
                            >
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: toneSoft[n.tone],
                                        color: toneFg[n.tone],
                                        display: "grid",
                                        placeItems: "center",
                                        flex: "0 0 auto",
                                        marginTop: 1,
                                    }}
                                >
                                    <Ic size={16} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                                    <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                fontSize: 13.5,
                                                lineHeight: 1.3,
                                                flex: 1,
                                                minWidth: 0,
                                            }}
                                        >
                                            {n.title}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--fg-4)",
                                                flex: "0 0 auto",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {n.time}
                                        </div>
                                    </div>
                                    <div
                                        className="notifications-popover__body"
                                        style={{
                                            color: "var(--fg-3)",
                                            fontSize: 12.5,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {n.sub}
                                    </div>
                                </div>
                                {n.unread ? (
                                    <span
                                        style={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: "50%",
                                            background: "var(--accent)",
                                            flex: "0 0 auto",
                                            marginTop: 6,
                                        }}
                                    />
                                ) : (
                                    <span style={{ width: 7, flex: "0 0 auto" }} />
                                )}
                            </button>
                        );
                    })
                )}
            </div>
            <div className="row" style={{ padding: "10px 14px", borderTop: "1px solid var(--line)", background: "rgba(0,0,0,0.02)", alignItems: "center" }}>
                <span className="spacer" style={{ flex: 1 }} />
                <button
                    type="button"
                    className="btn btn-ghost nav-link-forward"
                    style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => {
                        if (canSeeTasks) {
                            openTickets();
                            return;
                        }
                        onClose();
                        navigate("/");
                    }}
                >
                    {canSeeTasks
                        ? openTaskN > 0
                            ? tp("app.notifications.show_tasks_count", { count: openTaskN })
                            : t("app.notifications.show_tasks")
                        : t("app.notifications.show_dashboard")}{" "}
                    <ChevronRightIcon size={13} />
                </button>
            </div>
        </div>
    );
}
