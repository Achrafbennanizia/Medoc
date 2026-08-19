import { useT, useTParams } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import {
    getLogLevel,
    setLogLevel,
    exportLogs,
    verifyAuditChain,
    getLogDir,
    getExampleAppLogPath,
    type LogLevel,
} from "@/systems/practice-host/controllers/logging.controller";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { ExportIcon } from "@/lib/icons";
import { DataExportPickerDialog } from "@/views/components/data-export-picker-dialog";
import { PageLoadError, PageLoading } from "@/views/components/ui/page-status";
import { WorkspacePageHeader } from "@/views/components/administration-page-header";

const LEVELS: LogLevel[] = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"];

export function LoggingPage() {
    const t = useT();
    const tp = useTParams();
    const [level, setLevel] = useState<LogLevel>("INFO");
    const [logDir, setLogDir] = useState<string>("");
    const [exampleLogFile, setExampleLogFile] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [initLoading, setInitLoading] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const [exportPickerOpen, setExportPickerOpen] = useState(false);

    const loadMeta = useCallback(async () => {
        setInitLoading(true);
        setInitError(null);
        try {
            const [l, d] = await Promise.all([getLogLevel(), getLogDir()]);
            setLevel(l);
            setLogDir(d);
            try {
                setExampleLogFile(await getExampleAppLogPath(d));
            } catch {
                setExampleLogFile(null);
            }
        } catch (e) {
            setInitError(errorMessage(e));
        } finally {
            setInitLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadMeta();
    }, [loadMeta]);

    async function changeLevel(next: LogLevel) {
        try {
            await setLogLevel(next);
            setLevel(next);
            setMessage(tp("logging.level_set", { level: next }));
        } catch (e) {
            setMessage(tp("logging.level_set_failed", { message: errorMessage(e) }));
        }
    }

    const resolveLogExport = useCallback(async () => {
        const bytes = await exportLogs();
        return {
            exportTitle: t("logging.export.title"),
            hint: t("logging.export.hint"),
            suggestedFilename: `medoc-logs-${new Date().toISOString().slice(0, 10)}.zip`,
            binaryBody: new Uint8Array(bytes),
            mime: "application/zip",
        };
    }, [t]);

    async function handleVerify() {
        setBusy(true);
        setMessage(null);
        try {
            const broken = await verifyAuditChain();
            setMessage(
                broken
                    ? tp("logging.audit_broken", { id: broken })
                    : t("logging.audit_ok"),
            );
        } catch (e: unknown) {
            setMessage(tp("logging.verify_failed", { message: errorMessage(e) }));
        } finally {
            setBusy(false);
        }
    }

    if (initLoading) {
        return (
            <div className="practice-workspace-page animate-fade-in">
                <WorkspacePageHeader title={t("logging.title")} />
                <PageLoading label={t("logging.loading")} />
            </div>
        );
    }
    if (initError) {
        return (
            <div className="practice-workspace-page animate-fade-in">
                <WorkspacePageHeader title={t("logging.title")} />
                <PageLoadError message={initError} onRetry={() => void loadMeta()} />
            </div>
        );
    }

    return (
        <div className="practice-workspace-page animate-fade-in">
            <WorkspacePageHeader title={t("logging.title")} />

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">{t("logging.level_section")}</h3>
                <p className="text-body text-on-surface-variant">
                    {t("logging.level_section_hint")}
                </p>
                <div className="flex gap-2">
                    {LEVELS.map((l) => (
                        <button
                            key={l}
                            onClick={() => changeLevel(l)}
                            className={`btn ${level === l ? "btn-accent" : "btn-subtle"}`}
                            style={{ padding: "6px 10px", fontSize: 12 }}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">{t("logging.dir_section")}</h3>
                <p className="text-body font-mono text-on-surface-variant">{logDir}</p>
                {exampleLogFile ? (
                    <p className="text-body text-on-surface-variant" style={{ margin: 0, fontSize: 12 }}>
                        {t("logging.example_path")} <span className="font-mono">{exampleLogFile}</span>
                    </p>
                ) : null}
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">{t("logging.export_section")}</h3>
                <p className="text-body text-on-surface-variant">
                    {t("logging.export_section_hint")}
                </p>
                <Button type="button" variant="secondary" onClick={() => setExportPickerOpen(true)} disabled={busy}>
                    <ExportIcon size={14} /> {t("common.export")}
                </Button>
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 className="text-title">{t("logging.audit_integrity")}</h3>
                <p className="text-body text-on-surface-variant">
                    {t("logging.verify_hint")}
                </p>
                <Button type="button" variant="secondary" onClick={() => void handleVerify()} disabled={busy}>
                    {t("logging.verify_btn")}
                </Button>
            </div>

            {message && (
                <div className="card card-pad">{message}</div>
            )}
            <DataExportPickerDialog
                open={exportPickerOpen}
                onClose={() => setExportPickerOpen(false)}
                title={t("logging.export_dialog_title")}
                description={t("logging.export.description")}
                formats={[{ value: "zip", label: t("logging.export.zip_label") }]}
                defaultFormat="zip"
                resolvePayload={resolveLogExport}
            />
        </div>
    );
}
