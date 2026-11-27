import { useCallback, useEffect, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { backupOverview, createBackup, deleteBackup, pickBackupFolder, resetBackups, restoreBackup, setBackupFolder, setBackupSchedule, type BackupInfo, type BackupOverview } from "@/systems/practice-host/controllers/ops.controller";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { Button } from "@/views/components/ui/button";
import { ConfirmDialog } from "@/views/components/ui/dialog";
import { PageLoadError, TableSkeleton } from "@/views/components/ui/page-status";
import { useToastStore } from "@/views/components/ui/toast-store";
import { ReasonDialog, formatBytes } from "./backup-reason-dialog";

/**
 * Settings → Backups (practice administrator, `ops.backup`).
 * Automatic daily backup, rotated to 3 daily + last week + last half-year; compressed and
 * encrypted. Every action here is written to the audit log with who, when and why.
 */
export function SettingsBackupsSection() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [data, setData] = useState<BackupOverview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [pauseOpen, setPauseOpen] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<BackupInfo | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            setData(await backupOverview());
        } catch (e) {
            setError(errorMessage(e));
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const run = async (fn: () => Promise<unknown>, okKey: string) => {
        setBusy(true);
        try {
            await fn();
            toast(t(okKey), "success");
            await load();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    if (error) return <PageLoadError message={error} onRetry={() => void load()} />;
    if (!data) return <TableSkeleton label={t("settings.backups.loading")} rows={5} />;

    const last = data.backups.find((b) => b.created_at)?.created_at ?? null;
    const onlyOne = data.backups.length <= 1;
    const whenOf = (b: BackupInfo | null) => (b?.created_at ? formatDateTime(b.created_at) : "—");
    const tierLabel = (tier: string) => t(`settings.backups.tier.${tier}`);

    return (
        <section className="settings-subcard settings-backups">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.backups.title")}</div>
                    <div className="card-sub">{t("settings.backups.subtitle")}</div>
                </div>
            </div>

            <div className="settings-row">
                <div>
                    <b>{t("settings.backups.auto")}</b>
                    <div className="card-sub">{t("settings.backups.policy")}</div>
                    {data.schedule?.changedAt ? (
                        <div className="card-sub settings-row__note">
                            {tp(data.enabled ? "settings.backups.resumed_by" : "settings.backups.paused_by", {
                                who: data.schedule.changedBy ?? "—",
                                when: formatDateTime(data.schedule.changedAt),
                                reason: data.schedule.reason || "—",
                            })}
                        </div>
                    ) : null}
                </div>
                <div className="settings-backups__toggle">
                    <span className={`settings-backups__state${data.enabled ? " is-on" : ""}`}>
                        {t(data.enabled ? "settings.backups.state_on" : "settings.backups.state_off")}
                    </span>
                    <SettingsSwitch
                        ariaLabel={t("settings.backups.auto")}
                        checked={data.enabled}
                        disabled={busy}
                        onChange={() => {
                            if (data.enabled) setPauseOpen(true);
                            else void run(() => setBackupSchedule(true, ""), "settings.backups.toast.resumed");
                        }}
                    />
                </div>
            </div>

            <div className="settings-row">
                <div className="settings-backups__where">
                    <b>{t("settings.backups.where")}</b>
                    <div className="settings-backups__dir-line">
                        <span className={`settings-backups__place${data.external ? " is-external" : ""}`}>
                            {t(data.external ? "settings.backups.place_external" : "settings.backups.place_local")}
                        </span>
                        <span className="card-sub settings-backups__dir" title={data.backup_dir}>
                            {data.backup_dir}
                        </span>
                    </div>
                    {data.chosen_dir_missing ? (
                        <div className="settings-backups__warn" role="status">
                            {tp("settings.backups.folder_missing", { folder: data.chosen_dir ?? "" })}
                        </div>
                    ) : (
                        <div className="card-sub">{t(data.external ? "settings.backups.where_hint_external" : "settings.backups.where_hint_local")}</div>
                    )}
                </div>
                <div className="settings-backups__where-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                            void (async () => {
                                const folder = await pickBackupFolder().catch(() => null);
                                if (!folder) return;
                                await run(async () => setData(await setBackupFolder(folder)), "settings.backups.toast.folder");
                            })()
                        }
                    >
                        {t("settings.backups.choose_folder")}
                    </Button>
                    {data.chosen_dir ? (
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void run(async () => setData(await setBackupFolder(null)), "settings.backups.toast.folder_local")}
                        >
                            {t("settings.backups.use_local")}
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="settings-row">
                <div>
                    <b>
                        {tp("settings.backups.summary", {
                            count: data.backups.length,
                            size: formatBytes(data.total_bytes),
                        })}
                    </b>
                    <div className="card-sub">{last ? tp("settings.backups.last", { when: formatDateTime(last) }) : t("settings.backups.none")}</div>
                    <div className="card-sub">
                        {tp("settings.backups.files", { count: data.files_count, size: formatBytes(data.files_bytes) })}
                    </div>
                </div>
                <Button type="button" onClick={() => void run(createBackup, "settings.backups.toast.created")} disabled={busy}>
                    {t("settings.backups.run_now")}
                </Button>
            </div>

            <div className="settings-backups__table-wrap">
                <table className="settings-backups__table">
                    <thead>
                        <tr>
                            <th scope="col">{t("settings.backups.col.date")}</th>
                            <th scope="col">{t("settings.backups.col.kept_as")}</th>
                            <th scope="col">{t("settings.backups.col.size")}</th>
                            <th scope="col">{t("settings.backups.col.integrity")}</th>
                            <th scope="col">
                                <span className="sr-only">{t("settings.backups.col.actions")}</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.backups.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="card-sub">
                                    {t("settings.backups.none")}
                                </td>
                            </tr>
                        ) : (
                            data.backups.map((b) => (
                                <tr key={b.path}>
                                    <td>{b.created_at ? formatDateTime(b.created_at) : "—"}</td>
                                    <td>
                                        {(b.tiers ?? []).length ? (
                                            (b.tiers ?? []).map((tier) => (
                                                <span key={tier} className="settings-backups__chip">
                                                    {tierLabel(tier)}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="card-sub">{t("settings.backups.tier.rotating_out")}</span>
                                        )}
                                    </td>
                                    <td>
                                        {formatBytes(b.size_bytes)}
                                        {b.compressed === false ? <span className="card-sub"> · {t("settings.backups.legacy")}</span> : null}
                                    </td>
                                    <td>
                                        {b.signature_ok === true ? (
                                            t("settings.backups.integrity.ok")
                                        ) : b.signature_ok === false ? (
                                            <span className="settings-backups__bad">{t("settings.backups.integrity.bad")}</span>
                                        ) : (
                                            t("settings.backups.integrity.unsigned")
                                        )}
                                    </td>
                                    <td className="settings-backups__actions">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => setRestoreTarget(b)}
                                            disabled={busy || b.signature_ok === false}
                                        >
                                            {t("settings.backups.restore")}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setDeleteTarget(b)}
                                            disabled={busy || onlyOne}
                                            title={onlyOne ? t("settings.backups.delete_last_hint") : undefined}
                                        >
                                            {t("settings.backups.delete")}
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="settings-row">
                <div>
                    <b>{t("settings.backups.reset")}</b>
                    <div className="card-sub">{t("settings.backups.reset_hint")}</div>
                </div>
                <Button type="button" variant="danger" onClick={() => setResetOpen(true)} disabled={busy}>
                    {t("settings.backups.reset_button")}
                </Button>
            </div>

            <ReasonDialog
                open={pauseOpen}
                title={t("settings.backups.pause_title")}
                message={t("settings.backups.pause_message")}
                confirmLabel={t("settings.backups.pause_confirm")}
                danger
                busy={busy}
                onClose={() => setPauseOpen(false)}
                onConfirm={(reason) => {
                    setPauseOpen(false);
                    void run(() => setBackupSchedule(false, reason), "settings.backups.toast.paused");
                }}
            />
            <ReasonDialog
                open={resetOpen}
                title={t("settings.backups.reset_title")}
                message={t("settings.backups.reset_message")}
                confirmLabel={t("settings.backups.reset_button")}
                danger
                busy={busy}
                onClose={() => setResetOpen(false)}
                onConfirm={(reason) => {
                    setResetOpen(false);
                    void run(() => resetBackups(reason), "settings.backups.toast.reset");
                }}
            />
            <ReasonDialog
                open={deleteTarget != null}
                title={t("settings.backups.delete_title")}
                message={tp("settings.backups.delete_message", {
                    when: whenOf(deleteTarget),
                })}
                confirmLabel={t("settings.backups.delete_confirm")}
                danger
                busy={busy}
                onClose={() => setDeleteTarget(null)}
                onConfirm={(reason) => {
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    if (target) void run(() => deleteBackup(target.path, reason), "settings.backups.toast.deleted");
                }}
            />
            <ConfirmDialog
                open={restoreTarget != null}
                onClose={() => setRestoreTarget(null)}
                danger
                loading={busy}
                title={t("settings.backups.restore_title")}
                message={tp("settings.backups.restore_message", {
                    when: whenOf(restoreTarget),
                })}
                confirmLabel={t("settings.backups.restore_confirm")}
                onConfirm={() => {
                    const target = restoreTarget;
                    if (!target) return;
                    setBusy(true);
                    restoreBackup(target.path)
                        .then((r) => {
                            toast(
                                r.restored_files > 0
                                    ? tp("settings.backups.toast.restored_files", { count: r.restored_files })
                                    : t("settings.backups.toast.restored"),
                                "success",
                            );
                            // Every screen holds data from before the jump: reload from the restored database.
                            window.setTimeout(() => window.location.reload(), 1200);
                        })
                        .catch((e) => {
                            toast(errorMessage(e), "error");
                            setBusy(false);
                            setRestoreTarget(null);
                        });
                }}
            />
        </section>
    );
}
