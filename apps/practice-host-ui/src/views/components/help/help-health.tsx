/**
 * Help → Support: what the support file will say about this computer (editions plan §11.5), and the
 * requests from MeDoc support waiting for the admin (built, off until the company server channel exists).
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
    acknowledgeNumberingGap,
    decideRemoteCommand,
    getHealthSummary,
    listRemoteCommands,
    type HealthSummary,
    type RemoteCommands,
} from "@/systems/practice-host/controllers/system.controller";
import { Button } from "@/views/components/ui/button";

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
    return (
        <div className="help-health__row">
            <dt>{label}</dt>
            <dd className={warn ? "help-health__warn" : undefined}>{value}</dd>
        </div>
    );
}

export function HelpHealth() {
    const t = useT();
    const tp = useTParams();
    const [health, setHealth] = useState<HealthSummary | null>(null);
    const [remote, setRemote] = useState<RemoteCommands | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [h, r] = await Promise.all([getHealthSummary(), listRemoteCommands()]);
            setHealth(h);
            setRemote(r);
        } catch (e) {
            setError(errorMessage(e));
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    if (error) return <p className="help-support__error">{error}</p>;
    if (!health) return null;

    const ok = (v: boolean) => (v ? t("help.health.ok") : t("help.health.problem"));
    const backupAge = health.lastBackupAgeHours;
    const errors = health.errorsByArea7d.reduce((n, e) => n + e.count, 0);
    const problems = health.syncOpenProblems ?? 0;
    const freeGb = health.diskFreeBytes == null ? null : health.diskFreeBytes / 1e9;

    return (
        <section className="help-health" aria-labelledby="help-health-title">
            <h3 id="help-health-title" className="help-health__title">
                {t("help.health.title")}
            </h3>
            <dl className="help-health__list">
                <Row label={t("help.health.version")} value={`${health.version} · ${health.edition}`} />
                <Row
                    label={t("help.health.os")}
                    value={tp("help.health.os_value", { os: health.os, arch: health.osArch ?? health.osFamily ?? "—" })}
                />
                <Row label={t("help.health.database")} value={ok(health.dbOk)} warn={!health.dbOk} />
                <Row label={t("help.health.audit")} value={ok(health.auditChainOk)} warn={!health.auditChainOk} />
                <Row
                    label={t("help.health.backup")}
                    value={backupAge == null ? t("help.health.backup_none") : tp("help.health.backup_age", { hours: backupAge })}
                    warn={backupAge == null || backupAge > 48}
                />
                {freeGb == null ? null : (
                    <Row
                        label={t("help.health.disk")}
                        value={tp("help.health.disk_value", { gb: freeGb.toFixed(1) })}
                        warn={freeGb < 5}
                    />
                )}
                {__CAP_NET__ ? (
                    <Row
                        label={t("help.health.sync")}
                        value={
                            health.syncUpdateNeeded
                                ? t("error.sync.update_needed")
                                : tp("help.health.sync_value", { pending: health.syncPendingOutbox ?? 0, problems })
                        }
                        warn={problems > 0 || health.syncUpdateNeeded}
                    />
                ) : null}
                <Row label={t("help.health.errors")} value={tp("help.health.errors_value", { n: errors })} />
                <Row
                    label={t("help.health.logs")}
                    value={
                        health.logs?.available
                            ? tp("help.health.logs_value", {
                                  errorsKb: ((health.logs.errors?.bytes ?? 0) / 1024).toFixed(0),
                                  appKb: ((health.logs.app?.bytes ?? 0) / 1024).toFixed(0),
                              })
                            : t("help.health.logs_none")
                    }
                />
            </dl>
            {__CAP_NET__ && problems > 0 ? (
                <Link className="help-health__link" to="/settings?tab=system">
                    {t("help.health.open_maintenance")}
                </Link>
            ) : null}
            {Object.keys(health.numberingGaps ?? {}).length > 0 ? (
                <div className="help-health__remote">
                    <h4>{t("help.health.gaps_title")}</h4>
                    <p>{t("help.health.gaps_hint")}</p>
                    {Object.entries(health.numberingGaps).map(([sequence, missing]) => (
                        <div key={sequence} className="help-health__remote-row">
                            <span className="help-health__warn">{tp("help.health.gap_row", { sequence, missing })}</span>
                            <Button type="button" size="sm" variant="secondary" onClick={() => void acknowledgeNumberingGap(sequence).then(load)}>
                                {t("help.health.gap_ack")}
                            </Button>
                        </div>
                    ))}
                </div>
            ) : null}
            {remote?.enabled && remote.pending.length > 0 ? (
                <div className="help-health__remote">
                    <h4>{t("help.remote.title")}</h4>
                    {remote.pending.map((c) => (
                        <div key={c.nonce} className="help-health__remote-row">
                            <span>{t(`help.remote.command.${c.command}`)}</span>
                            <Button type="button" size="sm" onClick={() => void decideRemoteCommand(c.nonce, true).then(load)}>
                                {t("help.remote.approve")}
                            </Button>
                            <Button type="button" size="sm" variant="secondary" onClick={() => void decideRemoteCommand(c.nonce, false).then(load)}>
                                {t("help.remote.refuse")}
                            </Button>
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    );
}
