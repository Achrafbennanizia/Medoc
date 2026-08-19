import { useEffect, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import {
    CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT,
    CHART_ATTACHMENT_DOCUMENT_KINDS,
    LS_CHART_SCAN_FOLDER,
    normalizeChartDocumentKind,
} from "@/lib/chart-attachments";
import {
    openSystemScanUtility,
    scannerListRecent,
    type ScannedDocument,
} from "@/systems/practice-host/controllers/system.controller";
import { Dialog } from "@/views/components/ui/dialog";
import { Input, Select } from "@/views/components/ui/input";
import { Button } from "@/views/components/ui/button";
import { useToastStore } from "@/views/components/ui/toast-store";
import { errorMessage } from "@/lib/utils";

type Props = {
    open: boolean;
    busy: boolean;
    onClose: () => void;
    onImport: (srcPath: string, documentKind: string) => Promise<void>;
};

export function ChartScannerImportDialog({ open, busy, onClose, onImport }: Props) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [scanFolder, setScanFolder] = useState("");
    const [scanDocs, setScanDocs] = useState<ScannedDocument[]>([]);
    const [scanBusy, setScanBusy] = useState(false);
    const [documentKind, setDocumentKind] = useState(CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT);

    useEffect(() => {
        if (!open) return;
        setDocumentKind(CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT);
        try {
            const saved = localStorage.getItem(LS_CHART_SCAN_FOLDER);
            if (saved) setScanFolder(saved);
        } catch {
            /* ignore */
        }
    }, [open]);

    const refreshScanList = async () => {
        if (!scanFolder.trim()) {
            return;
        }
        setScanBusy(true);
        try {
            const docs = await scannerListRecent(scanFolder.trim(), 20);
            setScanDocs(docs);
            try {
                localStorage.setItem(LS_CHART_SCAN_FOLDER, scanFolder.trim());
            } catch {
                /* ignore */
            }
        } catch (e) {
            setScanDocs([]);
            toast(tp("migration.device.scanner_error", { message: errorMessage(e) }), "error");
        } finally {
            setScanBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={() => {
                if (busy) return;
                onClose();
            }}
            title={t("chart.attachments.scanner")}
            footer={(
                <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                    {t("common.close")}
                </Button>
            )}
        >
            <div className="col" style={{ gap: 12 }}>
                <p className="page-sub" style={{ margin: 0, fontSize: 13 }}>
                    {t("migration.device.scanner_folder_hint")}
                </p>
                <Input
                    id="chart-scan-folder"
                    label={t("page.administration.contracts.field.scan_folder")}
                    value={scanFolder}
                    onChange={(e) => setScanFolder(e.target.value)}
                    placeholder={t("page.administration.contracts.field.scan_folder_ph")}
                />
                <Select
                    id="chart-scan-doc-kind"
                    label={t("chart.attachments.doc_type")}
                    value={documentKind}
                    options={CHART_ATTACHMENT_DOCUMENT_KINDS.map((k) => ({
                        value: k.id,
                        label: t(k.labelKey),
                    }))}
                    onChange={(e) => setDocumentKind(normalizeChartDocumentKind(e.target.value))}
                />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={scanBusy || busy}
                        onClick={() => {
                            void (async () => {
                                try {
                                    await openSystemScanUtility();
                                } catch (e) {
                                    toast(tp("page.administration.contracts.toast.scanner_app_error", { message: errorMessage(e) }), "error");
                                }
                            })();
                        }}
                    >
                        {t("page.administration.contracts.btn.scanner_open")}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void refreshScanList()}
                        disabled={scanBusy || !scanFolder.trim()}
                        loading={scanBusy}
                    >
                        {t("page.administration.contracts.btn.refresh_list")}
                    </Button>
                </div>
                {scanDocs.length > 0 ? (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 240, overflow: "auto" }}>
                        {scanDocs.map((d) => (
                            <li
                                key={d.path}
                                className="row"
                                style={{
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "8px 0",
                                    borderBottom: "1px solid var(--line)",
                                }}
                            >
                                <span style={{ fontSize: 13, minWidth: 0, wordBreak: "break-all" }}>
                                    {d.path.split("/").pop() ?? d.path}{" "}
                                    <span style={{ color: "var(--fg-3)" }}>
                                        {tp("page.administration.contracts.scan.bytes", { bytes: d.bytes })}
                                    </span>
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={busy}
                                    loading={busy}
                                    onClick={() => void onImport(d.path, documentKind)}
                                >
                                    {t("common.add")}
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                        {t("page.administration.contracts.scan.empty")}
                    </p>
                )}
            </div>
        </Dialog>
    );
}
