import { useMemo, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistance } from "date-fns";
import {
    CalendarIcon,
    ChevronRightIcon,
    ClipboardIcon,
    PackageIcon,
    SettingsIcon,
    ShieldIcon,
    SparkleIcon,
    StethoscopeIcon,
} from "@/lib/icons";
import { useDateFnsLocale, useT } from "@/lib/i18n";
import { useNow } from "@/lib/practice-clock";
import { NOTICE_CATEGORIES, type Notice, type NoticeCategory } from "@/systems/practice-host/notifications/notice";
import { useNotificationCenter } from "@/systems/practice-host/notifications/notification-center";
import { useToastStore } from "./ui/toast-store";

const CATEGORY_ICON: Record<NoticeCategory, FC<{ size?: number }>> = {
    task: ClipboardIcon,
    appointment: CalendarIcon,
    clinical: StethoscopeIcon,
    inventory: PackageIcon,
    security: ShieldIcon,
    system: SparkleIcon,
};

/**
 * Notification popover — presentation only. Data, read-state and delivery live in the notification center
 * (`packages/app/practice-host/src/notifications`). Filter by category, open the item, mark read.
 */
export function NotificationsPopover({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate();
    const t = useT();
    const toast = useToastStore((s) => s.add);
    const dateFnsLocale = useDateFnsLocale();
    const now = useNow();
    const notices = useNotificationCenter((s) => s.notices);
    const unreadCount = useNotificationCenter((s) => s.unreadCount);
    const failed = useNotificationCenter((s) => s.failedSources);
    const markRead = useNotificationCenter((s) => s.markRead);
    const markAllRead = useNotificationCenter((s) => s.markAllRead);
    const [filter, setFilter] = useState<NoticeCategory | "all">("all");

    const counts = useMemo(() => {
        const c: Partial<Record<NoticeCategory, number>> = {};
        for (const n of notices) if (n.unread) c[n.category] = (c[n.category] ?? 0) + 1;
        return c;
    }, [notices]);
    const presentCategories = NOTICE_CATEGORIES.filter((c) => notices.some((n) => n.category === c));
    const visible = filter === "all" ? notices : notices.filter((n) => n.category === filter);

    const open = async (n: Notice) => {
        try {
            await markRead(n);
        } catch {
            /* still navigate */
        }
        if (n.href) {
            onClose();
            navigate(n.href);
        }
    };

    const onMarkAll = async () => {
        try {
            await markAllRead(filter === "all" ? undefined : filter);
            toast(t("app.notifications.marked_all"), "success");
        } catch (e) {
            toast(e instanceof Error ? e.message : t("common.error"), "error");
        }
    };

    return (
        <div className="notifications-popover" role="dialog" aria-label={t("app.notifications.title")}>
            <header className="notifications-popover__head">
                <h2 className="notifications-popover__title">{t("app.notifications.title")}</h2>
                {unreadCount > 0 ? (
                    <span className="pill accent">
                        {unreadCount} {t("common.new")}
                    </span>
                ) : null}
                <span className="notifications-popover__spacer" />
                <button
                    type="button"
                    className="btn btn-ghost notifications-popover__mark"
                    disabled={unreadCount === 0}
                    onClick={() => void onMarkAll()}
                >
                    {t("app.notifications.mark_all_read")}
                </button>
            </header>

            {presentCategories.length > 1 ? (
                <div className="notifications-popover__filters" role="group" aria-label={t("app.notifications.filter_aria")}>
                    {(["all", ...presentCategories] as const).map((c) => (
                        <button
                            key={c}
                            type="button"
                            className="notifications-popover__chip"
                            aria-pressed={filter === c}
                            onClick={() => setFilter(c)}
                        >
                            {t(`app.notifications.category.${c}`)}
                            {c !== "all" && counts[c] ? <span className="notifications-popover__chip-count">{counts[c]}</span> : null}
                        </button>
                    ))}
                </div>
            ) : null}

            <div className="notifications-popover__list">
                {visible.length === 0 ? (
                    <p className="notifications-popover__empty">{t("app.notifications.empty")}</p>
                ) : (
                    visible.map((n) => {
                        const Ic = CATEGORY_ICON[n.category];
                        return (
                            <button
                                key={n.id}
                                type="button"
                                className={`notifications-popover__item notifications-popover__item--${n.severity}${n.unread ? " is-unread" : ""}`}
                                onClick={() => void open(n)}
                            >
                                <span className={`notifications-popover__icon notifications-popover__icon--${n.category}`} aria-hidden>
                                    <Ic size={16} />
                                </span>
                                <span className="notifications-popover__text">
                                    <span className="notifications-popover__item-title">{n.title}</span>
                                    <span className="notifications-popover__item-body">{n.body}</span>
                                </span>
                                <time className="notifications-popover__time" dateTime={n.at.toISOString()}>
                                    {formatDistance(n.at, now, { addSuffix: true, locale: dateFnsLocale })}
                                </time>
                                {n.unread ? <span className="notifications-popover__dot" aria-label={t("common.new")} /> : null}
                            </button>
                        );
                    })
                )}
                {failed.length > 0 ? <p className="notifications-popover__warn">{t("app.notifications.partial")}</p> : null}
            </div>

            <footer className="notifications-popover__foot">
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                        onClose();
                        navigate("/settings?tab=notifications");
                    }}
                >
                    <SettingsIcon size={13} /> {t("app.notifications.settings")}
                </button>
                <span className="notifications-popover__spacer" />
                <button
                    type="button"
                    className="btn btn-ghost nav-link-forward"
                    onClick={() => {
                        onClose();
                        navigate("/tickets");
                    }}
                >
                    {t("app.notifications.show_tasks")} <ChevronRightIcon size={13} />
                </button>
            </footer>
        </div>
    );
}
