import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT, useTParams } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { Input } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { errorMessage } from "@/lib/utils";
import { MIGRATION_LIVE_DEVICE_ADAPTERS_ENABLED } from "@/lib/v1-ui-flags";
import {
    parseGdtFile,
    inspectDicomFile,
    scannerListRecent,
    scannerAttach,
    openSystemScanUtility,
    type GdtRecord,
    type DicomFileInfo,
    type ScannedDocument,
} from "@/systems/practice-host/controllers/system.controller";

const STEP_COUNT = 6;

/** Kurze Arbeitspunkte je Schritt — ergänzen den Fließtext. */
const STEP_FOCUS_KEY_GROUPS = [["migration.focus.s0_0","migration.focus.s0_1"],["migration.focus.s1_0","migration.focus.s1_1"],["migration.focus.s2_0","migration.focus.s2_1"],["migration.focus.s3_0","migration.focus.s3_1"],["migration.focus.s4_0","migration.focus.s4_1"],["migration.focus.s5_0","migration.focus.s5_1"]] as const;

export type MigrationWizardPageProps = {
    embedded?: boolean;
    /** Bei eingebetteter Ansicht statt Navigation nach /ops */
    onEmbeddedExit?: () => void;
};

export function MigrationWizardPage({ embedded = false, onEmbeddedExit }: MigrationWizardPageProps = {}) {
    const t = useT();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [step, setStep] = useState(0);
    const [checks, setChecks] = useState<boolean[]>(() => Array.from({ length: STEP_COUNT }, () => false));

    const stepComplete = checks[step] ?? false;

    const titles = useMemo(
        () => [
            t("page.migration.s0_title"),
            t("page.migration.s1_title"),
            t("page.migration.s2_title"),
            t("page.migration.s3_title"),
            t("page.migration.s4_title"),
            t("page.migration.s5_title"),
        ],
        [t],
    );

    const bodies = useMemo(
        () => [
            t("page.migration.s0_body"),
            t("page.migration.s1_body"),
            t("page.migration.s2_body"),
            t("page.migration.s3_body"),
            t("page.migration.s4_body"),
            t("page.migration.s5_body"),
        ],
        [t],
    );

    function toggleCheck() {
        setChecks((prev) => {
            const next = [...prev];
            next[step] = !next[step];
            return next;
        });
    }

    function next() {
        if (step >= STEP_COUNT - 1) {
            toast(t("page.migration.done_toast"), "success");
            if (embedded) {
                onEmbeddedExit?.();
                return;
            }
            navigate("/ops");
            return;
        }
        if (!stepComplete) return;
        setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
    }

    function back() {
        setStep((s) => Math.max(0, s - 1));
    }

    return (
        <div className="praxis-workspace-page animate-fade-in">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.migration.title")}
                subtitle={t("page.migration.intro")}
            />

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }} aria-hidden>
                {Array.from({ length: STEP_COUNT }, (_, i) => (
                    <span
                        key={i}
                        className="pill"
                        style={{
                            opacity: i === step ? 1 : i < step ? 0.85 : 0.45,
                            background: i === step ? "var(--accent-soft)" : undefined,
                            borderColor: i <= step ? "var(--accent)" : undefined,
                        }}
                    >
                        {i + 1}
                    </span>
                ))}
            </div>

            <Card>
                <div style={{ padding: 16, paddingTop: 14 }}>
                    <CardHeader title={titles[step] ?? ""} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
                        <p style={{ margin: 0, color: "var(--fg-2)", fontSize: 14, lineHeight: 1.6 }}>{bodies[step]}</p>
                        <ul
                            style={{
                                margin: 0,
                                paddingLeft: 20,
                                fontSize: 13,
                                color: "var(--fg-2)",
                                lineHeight: 1.55,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                            }}
                        >
                            {((STEP_FOCUS_KEY_GROUPS[step] ?? []) as readonly string[]).map((key) => (
                                <li key={key}>{t(key)}</li>
                            ))}
                        </ul>
                        <label className="row" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                            <input type="checkbox" checked={stepComplete} onChange={toggleCheck} />
                            <span style={{ fontSize: 14 }}>{t("page.migration.check_confirm")}</span>
                        </label>
                        <div className="row" style={{ gap: 10, marginTop: 8 }}>
                            <Button type="button" variant="ghost" onClick={back} disabled={step === 0}>
                                {t("page.migration.back")}
                            </Button>
                            <Button type="button" onClick={next} disabled={!stepComplete}>
                                {step >= STEP_COUNT - 1 ? t("page.migration.finish") : t("page.migration.next")}
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => (embedded ? onEmbeddedExit?.() : navigate("/ops"))}>
                                {t("page.migration.exit_ops")}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {step >= 2 && MIGRATION_LIVE_DEVICE_ADAPTERS_ENABLED ? (
                <>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)", maxWidth: 720 }}>
                        {t("migration.step3_adapters_hint")}
                    </p>
                    <DeviceFilePanel />
                </>
            ) : step >= 2 ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)", maxWidth: 720 }}>
                    {t("v1.migration.adapters_disabled")}
                </p>
            ) : null}
        </div>
    );
}

/**
 * Panel for the migration wizard that exercises the GDT / DICOM / TWAIN
 * adapters (FA-DEV-01..04, FA-MIG-*). Real connector code is stubbed in the
 * Rust layer; this UI verifies the wire is end-to-end.
 */
function DeviceFilePanel() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [gdtPath, setGdtPath] = useState("");
    const [gdtBusy, setGdtBusy] = useState(false);
    const [gdt, setGdt] = useState<GdtRecord | null>(null);
    const [dicomPath, setDicomPath] = useState("");
    const [dicomBusy, setDicomBusy] = useState(false);
    const [dicom, setDicom] = useState<DicomFileInfo | null>(null);
    const [scanFolder, setScanFolder] = useState("");
    const [scanBusy, setScanBusy] = useState(false);
    const [docs, setDocs] = useState<ScannedDocument[]>([]);
    const [attachPatient, setAttachPatient] = useState("");
    const [attachRoot, setAttachRoot] = useState("");

    async function runGdt() {
        if (!gdtPath.trim()) return;
        setGdtBusy(true);
        try {
            setGdt(await parseGdtFile(gdtPath.trim()));
        } catch (e) {
            toast(tp("migration.device.gdt_error", { message: errorMessage(e) }));
        } finally {
            setGdtBusy(false);
        }
    }

    async function runDicom() {
        if (!dicomPath.trim()) return;
        setDicomBusy(true);
        try {
            setDicom(await inspectDicomFile(dicomPath.trim()));
        } catch (e) {
            toast(tp("migration.device.dicom_error", { message: errorMessage(e) }));
        } finally {
            setDicomBusy(false);
        }
    }

    async function runScan() {
        if (!scanFolder.trim()) return;
        setScanBusy(true);
        try {
            setDocs(await scannerListRecent(scanFolder.trim(), 20));
        } catch (e) {
            toast(tp("migration.device.scanner_error", { message: errorMessage(e) }));
        } finally {
            setScanBusy(false);
        }
    }

    async function attachOne(src: string) {
        if (!attachRoot.trim() || !attachPatient.trim()) {
            toast(t("migration.device.require_paths"), "error");
            return;
        }
        try {
            const dest = await scannerAttach(src, attachRoot.trim(), attachPatient.trim());
            toast(tp("migration.device.attached", { dest }), "success");
        } catch (e) {
            toast(tp("migration.device.attach_failed", { message: errorMessage(e) }));
        }
    }

    return (
        <Card>
            <div style={{ padding: 16, paddingTop: 14 }}>
                <CardHeader title={t("migration.device.import_title")} />
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                    FA-DEV-01..04 · Geräte-Stubs zur lokalen Validierung
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                    <div>
                        <Input id="gdt-path" label={t("migration.device.gdt_file")} value={gdtPath} onChange={(e) => setGdtPath(e.target.value)} placeholder="/Users/…/export.gdt" />
                        <div className="row" style={{ marginTop: 8 }}><Button type="button" onClick={() => void runGdt()} disabled={gdtBusy} loading={gdtBusy}>{t("migration.device.gdt_check")}</Button></div>
                        {gdt ? (
                            <pre style={{ marginTop: 8, fontSize: 12, maxHeight: 200, overflow: "auto", background: "var(--surface-2)", padding: 8, borderRadius: 6 }}>{JSON.stringify(gdt, null, 2)}</pre>
                        ) : null}
                    </div>
                    <div>
                        <Input id="dicom-path" label={t("migration.device.dicom_file")} value={dicomPath} onChange={(e) => setDicomPath(e.target.value)} placeholder="/Users/…/image.dcm" />
                        <div className="row" style={{ marginTop: 8 }}><Button type="button" onClick={() => void runDicom()} disabled={dicomBusy} loading={dicomBusy}>{t("migration.device.dicom_check")}</Button></div>
                        {dicom ? (
                            <p style={{ fontSize: 12, marginTop: 8 }}><b>{dicom.is_dicom ? t("migration.device.dicom_ok") : t("migration.device.dicom_no_sig")}</b> · {dicom.size_bytes} Bytes</p>
                        ) : null}
                    </div>
                </div>
                <div style={{ marginTop: 16 }}>
                    <Input id="scan-folder" label={t("migration.device.scan_folder")} value={scanFolder} onChange={(e) => setScanFolder(e.target.value)} placeholder="/Users/…/scans" />
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--fg-3)", lineHeight: 1.45 }}>
                        Öffnen Sie zuerst die System-Scanner-App (Image Capture / Windows Scan / simple-scan) und speichern in diesen Ordner — dann „Liste aktualisieren“.
                    </p>
                    <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                void (async () => {
                                    try {
                                        await openSystemScanUtility();
                                    } catch (e) {
                                        toast(tp("migration.device.scanner_program", { message: errorMessage(e) }));
                                    }
                                })();
                            }}
                        >
                            System-Scanner öffnen
                        </Button>
                        <Button type="button" onClick={() => void runScan()} disabled={scanBusy} loading={scanBusy}>{t("migration.device.refresh_list")}</Button>
                    </div>
                    {docs.length > 0 ? (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                                <Input id="scan-archive" label={t("migration.device.archive_root")} value={attachRoot} onChange={(e) => setAttachRoot(e.target.value)} placeholder="/Users/…/akten" />
                                <Input id="scan-pid" label={t("migration.device.patient_id")} value={attachPatient} onChange={(e) => setAttachPatient(e.target.value)} placeholder="seed-pat-001" />
                            </div>
                            <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                                {docs.map((d) => (
                                    <li key={d.path} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                                        <span style={{ fontSize: 13 }}>{d.path} <span style={{ color: "var(--fg-3)" }}>({d.bytes} Bytes)</span></span>
                                        <Button size="sm" variant="ghost" onClick={() => void attachOne(d.path)}>{t("migration.device.attach_to_record")}</Button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : null}
                </div>
            </div>
        </Card>
    );
}
