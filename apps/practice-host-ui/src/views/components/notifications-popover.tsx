import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useToastStore } from "./ui/toast-store";
import {
    CheckIcon,
    ClipboardIcon,
    PackageIcon,
    PillIcon,
    SparkleIcon,
    ChevronRightIcon,
} from "@/lib/icons";
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
import { useDateFnsLocale, useT } from "@/lib/i18n";
import { useAuthStore } from "@/models/store/auth-store";

type Tone = "orange" | "red" | "green" | "blue" | "grey";

type NotifRow = {
    id: string;
    title: string;
    sub: string;
    time: string;
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
    if (kind === "PRACTICE_TASK_BACK") return "orange";
    if (kind === "PRACTICE_TASK_ASSIGNED") return "orange";
    if (kind === "PRACTICE_TASK_DONE") return "blue";
    if (kind.includes("prescription") || kind.includes("pill")) return "orange";
    if (kind.includes("inventory") || kind.includes("order")) return "red";
    return "blue";
}

function iconForKind(kind: string): FC<{ size?: number }> {
    if (kind === "plan_hint_fulfilled") return CheckIcon;
    if (isTaskNotificationKind(kind)) return ClipboardIcon;
    if (kind.includes("prescription") || kind.includes("pill")) return PillIcon;
    if (kind.includes("inventory") || kind.includes("order")) return PackageIcon;
    return SparkleIcon;
}

function formatNotifTime(raw: string, dateFnsLocale: ReturnType<typeof useDateFnsLocale>): string {
    const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}`;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return raw;
    return formatDistanceToNow(d, { addSuffix: true, locale: dateFnsLocale });
}

function mapToRows(items: InAppNotification[], dateFnsLocale: ReturnType<typeof useDateFnsLocale>): NotifRow[] {
    return items.map((n) => {
        let taskId: string | undefined;
        if (n.payload_json) {
            try {
                const p = JSON.parse(n.payload_json) as { taskId?: string };
                if (p.taskId) taskId = p.taskId;
            } catch {
                /* ignore */
            }
        }
        return {
            id: n.id,
            title: n.title,
            sub: n.body,
            time: formatNotifTime(n.created_at, dateFnsLocale),
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
        .map((task) => ({
            id: `task:${task.id}`,
            title: task.title,
            sub:
                task.status === "BACK"
                    ? t("app.notifications.task_returned")
                    : task.status === "DONE_RECEPTION"
                      ? t("app.notifications.task_needs_validation")
                      : t("app.notifications.task_open"),
            time: formatNotifTime(task.updated_at || task.created_at, dateFnsLocale),
            tone: task.status === "BACK" || task.status === "OPEN" ? "orange" : "blue",
            unread: true,
            Icon: ClipboardIcon,
            raw: null,
            taskId: task.id,
        }));
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
    const dateFnsLocale = useDateFnsLocale();
    const session = useAuthStore((s) => s.session);
    const role = session?.role;
    const canSeeTasks = role === "PHYSICIAN" || role === "RECEPTION";
    const [items, setItems] = useState<NotifRow[]>([]);
    const [loadError, setLoadError] = useState(false);

    const reload = useCallback(async () => {
        try {
            setLoadError(false);
            const list = await listInAppNotifications();
            const mapped = mapToRows(list, dateFnsLocale);
            const known = new Set(
                mapped.map((r) => r.taskId).filter((id): id is string => Boolean(id)),
            );
            let tasks: NotifRow[] = [];
            if (canSeeTasks) {
                try {
                    const open = await listPracticeTasksForMe();
                    tasks = taskRows(open, role, t, dateFnsLocale, known);
                } catch {
                    tasks = [];
                }
            }
            setItems([...tasks, ...mapped]);
        } catch {
            setLoadError(true);
            setItems([]);
        }
    }, [canSeeTasks, dateFnsLocale, role, t]);

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
            await markAllInAppNotificationsRead();
            await reload();
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
                setItems((xs) => xs.map((x) => (x.id === row.id ? { ...x, unread: false } : x)));
                onUnreadChanged?.();
            } catch {
                /* still navigate */
            }
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
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                width: 380,
                maxWidth: "min(380px, calc(100vw - 24px))",
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 14,
                boxShadow: "var(--shadow-lg)",
                zIndex: 50,
                overflow: "hidden",
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
            <div style={{ maxHeight: 380, overflow: "auto" }}>
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
                                className="ios-row"
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    font: "inherit",
                                    background: n.unread ? "rgba(14,160,126,0.04)" : "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "14px 18px",
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
                                    }}
                                >
                                    <Ic size={16} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n.title}</div>
                                    <div style={{ color: "var(--fg-3)", fontSize: 12.5 }} className="truncate">
                                        {n.sub}
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--fg-4)", flex: "0 0 auto" }}>{n.time}</div>
                                {n.unread ? (
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flex: "0 0 auto" }} />
                                ) : null}
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
                            ? t("app.notifications.show_tasks_count").replace("{{count}}", String(openTaskN))
                            : t("app.notifications.show_tasks")
                        : t("app.notifications.show_dashboard")}{" "}
                    <ChevronRightIcon size={13} />
                </button>
            </div>
        </div>
    );
}
