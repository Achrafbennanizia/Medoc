import { useCallback, useEffect, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useToastStore } from "./ui/toast-store";
import { CheckIcon, PackageIcon, PillIcon, SparkleIcon, ChevronRightIcon } from "@/lib/icons";
import {
    listInAppNotifications,
    markAllInAppNotificationsRead,
    markInAppNotificationRead,
} from "@/controllers/in-app-notification.controller";
import type { InAppNotification } from "@/models/types";
import { useLocale, useT } from "@/lib/i18n";

type Tone = "orange" | "red" | "green" | "blue" | "grey";

type NotifRow = {
    id: string;
    title: string;
    sub: string;
    time: string;
    tone: Tone;
    unread: boolean;
    Icon: FC<{ size?: number }>;
    raw: InAppNotification;
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

function toneForKind(kind: string): Tone {
    if (kind === "plan_hint_fulfilled") return "green";
    if (kind.includes("rezept") || kind.includes("pill")) return "orange";
    if (kind.includes("lager") || kind.includes("bestell")) return "red";
    return "blue";
}

function iconForKind(kind: string): FC<{ size?: number }> {
    if (kind === "plan_hint_fulfilled") return CheckIcon;
    if (kind.includes("rezept") || kind.includes("pill")) return PillIcon;
    if (kind.includes("lager") || kind.includes("bestell")) return PackageIcon;
    return SparkleIcon;
}

function formatNotifTime(raw: string, locale: "de" | "en"): string {
    const loc = locale === "en" ? enUS : de;
    const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}`;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return raw;
    return formatDistanceToNow(d, { addSuffix: true, locale: loc });
}

function mapToRows(items: InAppNotification[], locale: "de" | "en"): NotifRow[] {
    return items.map((n) => ({
        id: n.id,
        title: n.title,
        sub: n.body,
        time: formatNotifTime(n.created_at, locale),
        tone: toneForKind(n.kind),
        unread: !n.read_at,
        Icon: iconForKind(n.kind),
        raw: n,
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
    const locale = useLocale((s) => s.locale);
    const [items, setItems] = useState<NotifRow[]>([]);
    const [loadError, setLoadError] = useState(false);

    const reload = useCallback(async () => {
        try {
            setLoadError(false);
            const list = await listInAppNotifications();
            setItems(mapToRows(list, locale));
        } catch {
            setLoadError(true);
            setItems([]);
        }
    }, [locale]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const unreadN = items.filter((x) => x.unread).length;

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

    const onRowClick = async (row: NotifRow) => {
        if (row.unread) {
            try {
                await markInAppNotificationRead(row.id);
                setItems((xs) => xs.map((x) => (x.id === row.id ? { ...x, unread: false } : x)));
                onUnreadChanged?.();
            } catch {
                /* still navigate */
            }
        }
        try {
            if (row.raw.payload_json) {
                const p = JSON.parse(row.raw.payload_json) as { termin_id?: string };
                if (p.termin_id) {
                    onClose();
                    navigate("/termine");
                    return;
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
                    <span className="pill accent" style={{ marginLeft: 4 }}>
                        {unreadN} {locale === "en" ? "new" : "neu"}
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
                    className="btn btn-ghost"
                    style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => {
                        onClose();
                        navigate("/");
                    }}
                >
                    {t("app.notifications.show_dashboard")} <ChevronRightIcon size={13} />
                </button>
            </div>
        </div>
    );
}
