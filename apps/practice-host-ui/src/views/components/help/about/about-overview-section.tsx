/** Overview: one status card each for licence, practice network, data and updates. */
import { useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import { checkForUpdates, type UpdateInfo } from "@/systems/practice-host/controllers/system.controller";
import { Button } from "../../ui/button";
import { useToastStore } from "../../ui/toast-store";
import { AboutSection, StatusCard, Val, type AboutSectionId } from "./about-primitives";
import { dataTone, latestBackup, licenseTone, networkTone, type AboutStatus } from "./about-status";

type Props = { status: AboutStatus; version: string; role: string; nowMs: number; onGo: (id: AboutSectionId) => void };

export function AboutOverviewSection({ status, version, role, nowMs, onGo }: Props) {
    const t = useT();
    const tp = useTParams();
    const build = import.meta.env.DEV ? t("help.about.build.dev") : t("help.about.build.release");
    return (
        <AboutSection id="overview" intro={`${t("app.help.about_product")} · ${tp("help.about.version_line", { version, build })}`}>
            <div className="about-status-grid">
                <LicenseCard status={status} />
                <NetworkCard status={status} role={role} nowMs={nowMs} onDetails={() => onGo("network")} />
                <DataCard status={status} nowMs={nowMs} onDetails={() => onGo("data")} />
                <UpdateCard version={version} />
            </div>
        </AboutSection>
    );
}

function LicenseCard({ status }: { status: AboutStatus }) {
    const t = useT();
    const tp = useTParams();
    const title = t("help.about.card.license");
    if (status.license.state !== "ok") return <StatusCard title={title} tone="unknown" summary={<Val v={status.license}>{() => null}</Val>} />;
    const l = status.license.value;
    const edition = l.licenseV2?.edition ?? l.license?.edition ?? "—";
    return (
        <StatusCard
            title={title}
            tone={licenseTone(l)}
            summary={l.valid ? tp("help.about.license.valid", { edition }) : tp("help.about.license.invalid", { reason: l.reason ?? "—" })}
            detail={l.daysUntilExpiry != null ? tp("help.about.license.expires", { days: l.daysUntilExpiry }) : t("help.about.license.no_expiry")}
        />
    );
}

function DetailsButton({ onClick }: { onClick: () => void }) {
    const t = useT();
    return (
        <Button type="button" size="sm" variant="ghost" onClick={onClick}>
            {t("help.about.details")}
        </Button>
    );
}

function NetworkCard({ status, role, nowMs, onDetails }: { status: AboutStatus; role: string; nowMs: number; onDetails: () => void }) {
    const t = useT();
    const tp = useTParams();
    const title = t("help.about.card.network");
    if (status.sync.state !== "ok") return <StatusCard title={title} tone="unknown" summary={<Val v={status.sync}>{() => null}</Val>} />;
    const s = status.sync.value;
    return (
        <StatusCard
            title={title}
            tone={networkTone(s, nowMs)}
            summary={tp("help.about.network.summary", { role, peers: s.peers.length })}
            detail={tp("help.about.network.pending", { count: s.pendingOutbox })}
            action={<DetailsButton onClick={onDetails} />}
        />
    );
}

function DataCard({ status, nowMs, onDetails }: { status: AboutStatus; nowMs: number; onDetails: () => void }) {
    const t = useT();
    const tp = useTParams();
    const health = status.health.state === "ok" ? status.health.value : null;
    const backups = status.backups.state === "ok" ? status.backups.value : null;
    const last = backups ? latestBackup(backups) : null;
    const detail = backups
        ? last
            ? tp("help.about.data.last_backup", { when: formatDateTime(new Date(last.at).toISOString()) })
            : t("help.about.data.no_backup")
        : null;
    return (
        <StatusCard
            title={t("help.about.card.data")}
            tone={dataTone(health, backups, nowMs)}
            summary={health ? tp("help.about.data.db", { ms: health.db_latency_ms }) : <Val v={status.health}>{() => null}</Val>}
            detail={detail}
            action={<DetailsButton onClick={onDetails} />}
        />
    );
}

function UpdateCard({ version }: { version: string }) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [update, setUpdate] = useState<UpdateInfo | null>(null);
    const [busy, setBusy] = useState(false);
    const check = async () => {
        setBusy(true);
        try {
            setUpdate(await checkForUpdates());
        } catch (e) {
            toast(tp("help.about.update_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
        } finally {
            setBusy(false);
        }
    };
    const summary = update
        ? update.update_available
            ? tp("help.about.update.available", { version: update.latest_version })
            : tp("help.about.update.current", { version: update.current_version })
        : tp("help.about.update.installed", { version });
    return (
        <StatusCard
            title={t("help.about.card.updates")}
            tone={update ? (update.update_available ? "warn" : "ok") : "unknown"}
            summary={summary}
            detail={update ? tp("help.about.update.channel", { channel: update.channel }) : t("help.about.update.not_checked")}
            action={
                <Button type="button" size="sm" variant="secondary" loading={busy} disabled={busy} onClick={() => void check()}>
                    {t("help.about.update.check")}
                </Button>
            }
        />
    );
}
