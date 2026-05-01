import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { useToastStore } from "./ui/toast-store";
import { CheckIcon, PackageIcon, PillIcon, SparkleIcon, ChevronRightIcon } from "@/lib/icons";

type Tone = "orange" | "red" | "green" | "blue" | "grey";

type NotifRow = {
    id: number;
    title: string;
    sub: string;
    time: string;
    tone: Tone;
    unread: boolean;
    Icon: FC<{ size?: number }>;
};

const INITIAL: NotifRow[] = [
    { id: 1, title: "Freigabe ausstehend", sub: "Rezept · Prüfung durch Leitung", time: "vor 4 Min.", tone: "orange", unread: true, Icon: PillIcon },
    { id: 2, title: "Lagerbestand niedrig", sub: "Verbrauchsmaterial · Schwellenwert", time: "vor 1 Std.", tone: "red", unread: true, Icon: PackageIcon },
    { id: 3, title: "Bestellung bestätigt", sub: "Lieferung laut Plan", time: "vor 3 Std.", tone: "green", unread: false, Icon: CheckIcon },
    { id: 4, title: "Hinweis Praxis", sub: "Neuer Patient in der Warteliste", time: "heute", tone: "blue", unread: false, Icon: SparkleIcon },
];

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

export function NotificationsPopover({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [items, setItems] = useState<NotifRow[]>(INITIAL);

    const unreadN = items.filter((x) => x.unread).length;

    const markAllRead = () => {
        setItems((xs) => xs.map((x) => ({ ...x, unread: false })));
        toast("Alle als gelesen markiert", "success");
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
                <div style={{ fontWeight: 600, fontSize: 14 }}>Benachrichtigungen</div>
                {unreadN > 0 ? (
                    <span className="pill accent" style={{ marginLeft: 4 }}>
                        {unreadN} neu
                    </span>
                ) : null}
                <span className="spacer" style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={markAllRead}>
                    Alle gelesen
                </button>
            </div>
            <div style={{ maxHeight: 380, overflow: "auto" }}>
                {items.map((n) => {
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
                            onClick={() => {
                                setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
                            }}
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
                })}
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
                    Alle anzeigen <ChevronRightIcon size={13} />
                </button>
            </div>
        </div>
    );
}
