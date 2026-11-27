/**
 * Main device: changes that need the admin (T3.3, docs/architecture/editions-plan.md).
 * Mostly field conflicts — two devices changed the same field without seeing each other's
 * edit; the newer value was kept and the admin may take the other one. Same row language as
 * the guest inbox (Linear triage list): title, one line of facts, muted metadata, actions.
 * Renders nothing while there is nothing to decide.
 */
import { useCallback, useEffect, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage, formatDateTime } from "@/lib/utils";
import {
    syncProblemDismiss,
    syncProblemList,
    syncProblemRetry,
    type SyncProblem,
} from "@/systems/practice-host/controllers/sync.controller";
import { Button } from "@/views/components/ui/button";
import { SettingsPairingInbox } from "@/systems/practice-host/pages/settings/settings-pairing-inbox";

type Conflict = { kept: Record<string, unknown>; other: Record<string, unknown>; otherFromThisDevice: boolean };

function parseConflict(raw: string): Conflict | null {
    try {
        const v = JSON.parse(raw) as Conflict;
        return v && typeof v.kept === "object" && typeof v.other === "object" ? v : null;
    } catch {
        return null;
    }
}

function shown(value: unknown, empty: string): string {
    if (value === null || value === undefined || value === "") return empty;
    return typeof value === "string" ? value : JSON.stringify(value);
}

export function SettingsSyncConflicts() {
    const t = useT();
    const tp = useTParams();
    const [rows, setRows] = useState<SyncProblem[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rowError, setRowError] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        try {
            setRows(await syncProblemList());
        } catch {
            setRows([]);
        }
    }, []);

    useEffect(() => {
        void load();
        const id = window.setInterval(() => void load(), 30_000);
        return () => window.clearInterval(id);
    }, [load]);

    const act = async (row: SyncProblem, take: boolean) => {
        setBusyId(row.id);
        setRowError((e) => ({ ...e, [row.id]: "" }));
        try {
            await (take ? syncProblemRetry(row.id) : syncProblemDismiss(row.id));
            setRows((rs) => rs.filter((r) => r.id !== row.id));
        } catch (e) {
            setRowError((er) => ({ ...er, [row.id]: errorMessage(e) }));
        } finally {
            setBusyId(null);
        }
    };

    if (rows.length === 0) return null;

    const entity = (table: string) => t(`settings.sync_conflicts.entity.${table}`);
    const field = (name: string) => {
        const key = `settings.sync_conflicts.field.${name}`;
        const label = t(key);
        return label === key ? name.replace(/_/g, " ") : label;
    };

    return (
        <section className="settings-sync-conflicts" aria-labelledby="sync-conflicts-heading">
            <div className="card-title" id="sync-conflicts-heading">
                {tp("settings.sync_conflicts.title", { count: rows.length })}
            </div>
            <div className="card-sub">{t("settings.sync_conflicts.sub")}</div>
            <ul className="guest-inbox-list">
                {rows.map((r) => {
                    const c = r.kind === "FIELD_CONFLICT" ? parseConflict(r.error) : null;
                    const busy = busyId === r.id;
                    const fields = c ? Object.keys(c.other) : [];
                    const title = c
                        ? tp("settings.sync_conflicts.field_title", {
                              entity: entity(r.entityTable),
                              fields: fields.map(field).join(", "),
                          })
                        : t(`settings.sync_conflicts.kind.${r.kind}`);
                    const desc = c
                        ? fields
                              .map((f) =>
                                  tp("settings.sync_conflicts.field_desc", {
                                      field: field(f),
                                      kept: shown(c.kept[f], t("settings.sync_conflicts.empty_value")),
                                      other: shown(c.other[f], t("settings.sync_conflicts.empty_value")),
                                  }),
                              )
                              .join(" · ")
                        : r.error;
                    const from = c?.otherFromThisDevice
                        ? t("settings.sync_conflicts.other_this_device")
                        : tp("settings.sync_conflicts.other_device", { device: r.sourceDeviceId.slice(0, 8) });
                    return (
                        <li key={r.id} className="guest-inbox-row">
                            <div className="guest-inbox-row__main">
                                <div className="guest-inbox-row__title">{title}</div>
                                <div className="guest-inbox-row__desc">{desc}</div>
                                <div className="guest-inbox-row__meta">
                                    {c ? `${from} · ` : ""}
                                    {formatDateTime(r.createdAt)}
                                </div>
                                {rowError[r.id] ? (
                                    <div className="guest-inbox-row__error" role="alert">
                                        {rowError[r.id]}
                                    </div>
                                ) : null}
                            </div>
                            <div className="guest-inbox-row__actions">
                                <Button size="sm" variant="ghost" disabled={busyId != null} onClick={() => void act(r, false)}>
                                    {t(c ? "settings.sync_conflicts.keep" : "settings.sync_conflicts.dismiss")}
                                </Button>
                                <Button size="sm" loading={busy} disabled={busyId != null} onClick={() => void act(r, true)}>
                                    {t(c ? "settings.sync_conflicts.take_other" : "settings.sync_conflicts.retry")}
                                </Button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/** The main device's two inboxes in the device-network card: conflicts, then pairing requests. */
export function SettingsMasterInboxes({ conflicts, pairing }: { conflicts: boolean; pairing: boolean }) {
    return (
        <>
            {conflicts ? <SettingsSyncConflicts /> : null}
            {pairing ? (
                <div className="pairing-inbox-slot">
                    <SettingsPairingInbox embedded />
                </div>
            ) : null}
        </>
    );
}
