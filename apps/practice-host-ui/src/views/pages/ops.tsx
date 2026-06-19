import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    createBackup,
    listBackups,
    importPatientsCsv,
    pickBackupFile,
    pickPatientsCsvFile,
    restoreBackup,
    validateBackup,
    type BackupInfo,
    type ImportReport,
} from "@/systems/practice-host/controllers/ops.controller";
import {
    getPerfThresholdMs,
    setPerfThresholdMs,
    systemHealthCheck,
    type HealthCheck,
} from "@/systems/practice-host/controllers/system.controller";
import { getAuditChainStatus } from "@/systems/practice-host/controllers/audit-chain.controller";
import { errorMessage } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/dialog";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { DismissibleNotice } from "../components/ui/dismissible-notice";

const CSV_ERROR_PREVIEW_LIMIT = 50;

export type OpsPageProps = {
    /** Keine Navigation zur Migration - Callback z. B. innerhalb Einstellungen */
    embedded?: boolean;
    onOpenMigration?: () => void;
};

export function OpsPage({ embedded = false, onOpenMigration }: OpsPageProps = {}) {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const [backups, setBackups] = useState<BackupInfo[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [csvPath, setCsvPath] = useState("");
    const [backupValidatePath, setBackupValidatePath] = useState("");
    const [backupValidateMsg, setBackupValidateMsg] = useState<string | null>(null);
    const [dryRun, setDryRun] = useState(true);
    const [report, setReport] = useState<ImportReport | null>(null);
    const [health, setHealth] = useState<HealthCheck | null>(null);
    const [perfMs, setPerfMs] = useState("");
    const [perfSaved, setPerfSaved] = useState<string | null>(null);
    const [opsBlocked, setOpsBlocked] = useState(false);
    const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

    useEffect(() => {
        void getAuditChainStatus()
            .then((s) => setOpsBlocked(s.blocks_ops))
            .catch((e: unknown) => {
                setOpsBlocked(false);
                setMessage(tp("ops.audit_load_failed", { message: errorMessage(e) }));
            });
    }, []);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const list = await listBackups();
                if (!cancelled) setBackups(list);
            } catch (e: unknown) {
                if (!cancelled) setMessage(tp("ops.backups_load_failed", { message: errorMessage(e) }));
            }
        })();
        getPerfThresholdMs()
            .then((ms) => {
                if (!cancelled) setPerfMs(String(ms));
            })
            .catch(() => {
                if (!cancelled) setPerfMs("500");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function refresh() {
        try {
            setBackups(await listBackups());
        } catch (e: unknown) {
            setMessage(tp("ops.backups_load_failed", { message: errorMessage(e) }));
        }
    }

    async function handleBackup() {
        setBusy(true); setMessage(null);
        try {
            const info = await createBackup();
            setMessage(tp("ops.backup.created", { path: info.path, size: (info.size_bytes / 1024).toFixed(1) }));
            await refresh();
        } catch (e: unknown) {
            setMessage(`${t("common.error_prefix")} ${errorMessage(e)}`);
        } finally { setBusy(false); }
    }

    async function chooseCsvFile() {
        setMessage(null);
        try {
            const picked = await pickPatientsCsvFile();
            const path = picked ?? "";
            if (path) setCsvPath(path);
        } catch (e: unknown) {
            setMessage(tp("ops.file_pick_failed", { message: errorMessage(e) }));
        }
    }

    async function chooseBackupForValidate() {
        setBackupValidateMsg(null);
        try {
            const picked = await pickBackupFile();
            setBackupValidatePath(picked ?? "");
        } catch (e: unknown) {
            setMessage(tp("ops.file_pick_failed", { message: errorMessage(e) }));
        }
    }

    async function runValidateBackup() {
        if (!backupValidatePath.trim()) return;
        setBusy(true);
        setBackupValidateMsg(null);
        try {
            const ok = await validateBackup(backupValidatePath.trim());
            setBackupValidateMsg(ok ? t("ops.backup.validate_ok") : t("ops.backup.validate_invalid"));
        } catch (e: unknown) {
            setBackupValidateMsg(`${t("common.error_prefix")} ${errorMessage(e)}`);
        } finally {
            setBusy(false);
        }
    }

    async function runRestoreBackup() {
        const path = backupValidatePath.trim();
        if (!path) return;
        setBusy(true);
        setMessage(null);
        setBackupValidateMsg(null);
        try {
            const ok = await validateBackup(path);
            if (!ok) {
                setBackupValidateMsg(t("ops.backup.restore_aborted"));
                return;
            }
            const report = await restoreBackup(path);
            const hint = report.pre_restore_backup_created
                ? t("ops.backup.restore_pre_hint")
                : "";
            setMessage(
                tp("ops.backup.restore_success", { path: report.restored_from, hint }),
            );
            if (report.requires_app_restart) {
                window.setTimeout(() => window.location.reload(), 2500);
            }
        } catch (e: unknown) {
            setMessage(tp("ops.backup.restore_failed", { message: errorMessage(e) }));
        } finally {
            setBusy(false);
            setRestoreConfirmOpen(false);
        }
    }

    async function handleImport() {
        if (!csvPath.trim()) return;
        setBusy(true); setMessage(null); setReport(null);
        try {
            const r = await importPatientsCsv(csvPath, dryRun);
            setReport(r);
        } catch (e: unknown) {
            setMessage(`${t("common.error_prefix")} ${errorMessage(e)}`);
        } finally { setBusy(false); }
    }

    return (
        <div className="praxis-workspace-page animate-fade-in">
            <WorkspacePageHeader title={t("ops.page.title")} />

            {opsBlocked ? (
                <DismissibleNotice
                    variant="error"
                    role="alert"
                    closable={false}
                    title={t("ops.audit_tampered_title")}
                    subtitle={t("ops.page.subtitle_locked")}
                />
            ) : null}

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">{t("ops.migration.title")}</h3>
                <p className="text-body text-on-surface-variant">
                    {t("ops.migration.hint")}
                </p>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                        if (embedded && onOpenMigration) onOpenMigration();
                        else navigate("/migration");
                    }}
                >
                    {t("ops.migration.open_btn")}
                </Button>
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">{t("ops.health.title")}</h3>
                <p className="text-body text-on-surface-variant">
                    {t("ops.health.hint")}
                </p>
                <Button
                    type="button"
                    onClick={async () => {
                        setBusy(true);
                        try { setHealth(await systemHealthCheck()); }
                        finally { setBusy(false); }
                    }}
                    disabled={busy || opsBlocked}
                >
                    {t("ops.health.run_btn")}
                </Button>
                {health && (
                    <ul className="text-body" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }} aria-live="polite">
                        <li>{tp("ops.health.version", { version: health.version })}</li>
                        <li>{tp("ops.health.db", { status: health.db_ok ? t("ops.health.db_ok") : t("ops.health.db_error"), ms: health.db_latency_ms })}</li>
                        <li>{t("ops.page.audit_chain_label")} {health.audit_chain_ok ? t("ops.page.audit_chain_ok") : tp("ops.page.audit_chain_broken", { at: health.audit_broken_at ?? "" })}</li>
                        <li>{tp("ops.health.log_dir", { status: health.log_dir_writable ? t("ops.health.log_writable") : t("ops.health.log_not_writable") })}</li>
                    </ul>
                )}
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">{t("ops.perf.title")}</h3>
                <p className="text-body text-on-surface-variant">
                    {t("ops.perf.hint")}{" "}
                    <code className="px-1">perf.log</code>. {t("ops.perf.default_note")}
                </p>
                <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
                    <label className="flex flex-col gap-1 text-body" style={{ minWidth: 160 }}>
                        <span className="text-caption text-on-surface-variant">{t("ops.perf.threshold_label")}</span>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            value={perfMs}
                            onChange={(e) => setPerfMs(e.target.value)}
                            className="input-edit"
                            style={{ width: 160 }}
                        />
                    </label>
                    <Button
                        type="button"
                        onClick={async () => {
                            const n = Number.parseInt(perfMs, 10);
                            if (!Number.isFinite(n) || n < 1) {
                                setMessage(t("ops.perf.invalid"));
                                return;
                            }
                            setBusy(true);
                            setPerfSaved(null);
                            try {
                                await setPerfThresholdMs(n);
                                setPerfSaved(tp("ops.perf.saved", { ms: n }));
                            } catch (e: unknown) {
                                setMessage(`${t("common.error_prefix")} ${errorMessage(e)}`);
                            } finally {
                                setBusy(false);
                            }
                        }}
                        disabled={busy || opsBlocked}
                    >
                        {t("common.save")}
                    </Button>
                </div>
                {perfSaved && <p className="text-body text-accent-green">{perfSaved}</p>}
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">{t("ops.backup.title")}</h3>
                <p className="text-body text-on-surface-variant">
                    {t("ops.backup.hint")}
                    <code className="px-1">~/medoc-data/backups/</code>.
                </p>
                <Button type="button" onClick={() => void handleBackup()} disabled={busy || opsBlocked}>
                    {t("ops.backup.create_btn")}
                </Button>
                {backups.length > 0 && (
                    <ul className="text-body font-mono" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                        {backups.slice(0, 5).map((b) => (
                            <li key={b.path}>
                                {b.path} — {(b.size_bytes / 1024).toFixed(1)} KB
                                {b.signature_ok === true
                                    ? t("ops.backup.list_ok_sig")
                                    : b.signature_ok === false
                                      ? t("ops.backup.list_invalid_sig")
                                      : t("ops.backup.list_no_sig")}
                            </li>
                        ))}
                    </ul>
                )}
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
                    <p className="text-body text-on-surface-variant" style={{ margin: 0 }}>
                        {t("ops.backup.restore_hint")}
                    </p>
                    <div className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                        <Button type="button" variant="secondary" onClick={() => void chooseBackupForValidate()} disabled={busy || opsBlocked}>
                            {t("ops.backup.choose_file")}
                        </Button>
                        <span className="text-body text-on-surface-variant" style={{ flex: "1 1 200px", overflow: "hidden", textOverflow: "ellipsis" }} title={backupValidatePath || undefined}>
                            {backupValidatePath || t("common.no_file_selected")}
                        </span>
                        <Button type="button" variant="ghost" onClick={() => void runValidateBackup()} disabled={busy || opsBlocked || !backupValidatePath.trim()}>
                            {t("ops.backup.validate_btn")}
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={() => setRestoreConfirmOpen(true)}
                            disabled={busy || opsBlocked || !backupValidatePath.trim()}
                        >
                            {t("ops.backup.restore_btn")}
                        </Button>
                    </div>
                    {backupValidateMsg ? <p className="text-body" role="status" style={{ margin: 0 }}>{backupValidateMsg}</p> : null}
                </div>
            </div>

            <ConfirmDialog
                open={restoreConfirmOpen}
                onClose={() => setRestoreConfirmOpen(false)}
                title={t("ops.backup.restore_confirm_title")}
                message={t("ops.backup.restore_confirm_message")}
                confirmLabel={t("ops.backup.restore_confirm")}
                cancelLabel={t("common.cancel")}
                danger
                loading={busy}
                onConfirm={() => void runRestoreBackup()}
            />

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">{t("ops.csv.title")}</h3>
                <p className="text-body text-on-surface-variant">
                    {t("ops.csv.header_hint")}
                </p>
                <div className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <Button type="button" variant="secondary" onClick={() => void chooseCsvFile()} disabled={busy || opsBlocked}>
                        {t("ops.csv.choose_file")}
                    </Button>
                    <span className="text-body text-on-surface-variant" style={{ flex: "1 1 200px", overflow: "hidden", textOverflow: "ellipsis" }} title={csvPath || undefined}>
                        {csvPath || t("common.no_file_selected")}
                    </span>
                </div>
                <label className="flex items-center gap-2 text-body">
                    <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                    {t("ops.csv.dry_run")}
                </label>
                <Button type="button" onClick={() => void handleImport()} disabled={busy || opsBlocked || !csvPath.trim()}>
                    {t("ops.csv.import_btn")}
                </Button>
                {report && (
                    <div className="text-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div>{tp("ops.csv.total", { count: report.total_rows })}</div>
                        <div>{tp("ops.csv.imported", { count: report.imported })}</div>
                        <div>{tp("ops.page.import_skipped", { count: report.skipped })}</div>
                        <div>{tp("ops.csv.failed", { count: report.failed })}</div>
                        {report.errors.length > 0 && (
                            <details>
                                <summary>
                                    {tp("ops.csv.error_details", {
                                        count: report.errors.length,
                                        suffix: report.errors.length > CSV_ERROR_PREVIEW_LIMIT
                                            ? tp("ops.csv.error_preview_suffix", { limit: CSV_ERROR_PREVIEW_LIMIT })
                                            : "",
                                    })}
                                </summary>
                                <ul className="font-mono text-label mt-2" style={{ margin: 0, paddingLeft: 18 }}>
                                    {report.errors.slice(0, CSV_ERROR_PREVIEW_LIMIT).map((errLine, i) => (
                                        <li key={i}>{errLine}</li>
                                    ))}
                                </ul>
                                {report.errors.length > CSV_ERROR_PREVIEW_LIMIT ? (
                                    <p className="text-caption text-on-surface-variant mt-2" role="status">
                                        {tp("ops.csv.error_more", { count: report.errors.length - CSV_ERROR_PREVIEW_LIMIT })}
                                    </p>
                                ) : null}
                            </details>
                        )}
                    </div>
                )}
            </div>

            {message && <div className="card card-pad">{message}</div>}
        </div>
    );
}
