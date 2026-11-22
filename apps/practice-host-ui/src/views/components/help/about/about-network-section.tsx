/** Practice network: this device's role, seats, pending changes and the other devices. */
import { useT, useTParams } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import { AboutSection, Fact, Val } from "./about-primitives";
import { shortId, type AboutStatus } from "./about-status";

const STALE_AFTER_MS = 3_600_000;

export function AboutNetworkSection({ status, role, nowMs }: { status: AboutStatus; role: string; nowMs: number }) {
    const t = useT();
    const tp = useTParams();
    return (
        <AboutSection id="network">
            <dl className="help-facts">
                <Fact label={t("help.about.role")}>{role}</Fact>
                <Fact label={t("help.about.seats")}>
                    <Val v={status.cluster}>{(c) => (c.seatUsage ? tp("help.about.seats_value", { used: c.seatUsage.totalUsed }) : t("help.about.unavailable"))}</Val>
                </Fact>
                <Fact label={t("help.about.pending")}>
                    <Val v={status.sync}>{(s) => tp("help.about.network.pending", { count: s.pendingOutbox })}</Val>
                </Fact>
            </dl>
            <Val v={status.sync}>
                {(s) =>
                    s.peers.length ? (
                        <ul className="about-peers">
                            {s.peers.map((p) => {
                                const stale = !p.lastSeenAt || nowMs - Date.parse(p.lastSeenAt) > STALE_AFTER_MS;
                                return (
                                    <li key={p.deviceId} className="about-peer">
                                        <span className="about-peer__name">{p.displayName || shortId(p.deviceId)}</span>
                                        <span className="about-muted">{p.role === "MASTER" ? t("help.about.role.main") : t("help.about.role.replica")}</span>
                                        <span className={`pill ${stale ? "yellow" : "green"}`}>
                                            {p.lastSeenAt ? tp("help.about.last_seen", { when: formatDateTime(p.lastSeenAt) }) : t("help.about.never_seen")}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="about-muted">{t("help.about.no_peers")}</p>
                    )
                }
            </Val>
        </AboutSection>
    );
}
