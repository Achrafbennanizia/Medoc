import { useT, useTParams } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import type { Patient } from "@/models/types";
import { exportDischargeLeafletPdf } from "@/systems/practice-host/controllers/chart.controller";
import { finishExportWithSettings } from "@/lib/export";
import { pdfBase64ToBytes } from "@/systems/practice-host/controllers/document.controller";
import { useToastStore } from "./ui/toast-store";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import { checkPracticeDocumentReadiness } from "@/lib/practice-completeness";
import { PracticeReadinessDialog } from "./practice-readiness-dialog";
import { errorMessage, localIsoDate } from "@/lib/utils";

export type DischargeLeafletDialogProps = {
    open: boolean;
    onClose: () => void;
    patientId: string;
    patient: Patient | null;
};

export function DischargeLeafletDialog({ open, onClose, patientId, patient }: DischargeLeafletDialogProps) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [additionalNotes, setAdditionalNotes] = useState("");
    const [referralNotes, setReferralNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [practiceGuardOpen, setPracticeGuardOpen] = useState(false);
    const practiceReadiness = checkPracticeDocumentReadiness(getInvoicePracticeFromStorage(), "chart");

    useEffect(() => {
        if (!open) {
            setAdditionalNotes("");
            setReferralNotes("");
            setBusy(false);
        }
    }, [open]);

    const suggestedFilename = useMemo(() => {
        if (!patient) return t("discharge.leaflet.filename");
        // Patient id prefix instead of the name (data minimisation); local date.
        const id8 = patient.id.replace(/-/g, "").slice(0, 8);
        const ymd = localIsoDate(new Date());
        const base = t("discharge.leaflet.filename").replace(/\.pdf$/i, "");
        return `${base}-${id8}-${ymd}.pdf`;
    }, [patient, t]);

    const runExport = useCallback(async () => {
        if (!patient) {
            toast(t("export.picker.no_patient"), "error");
            return;
        }
        if (!practiceReadiness.ready) {
            setPracticeGuardOpen(true);
            return;
        }
        setBusy(true);
        try {
            // Final leaflet: NB number + registry entry; same leaflet again = KOPIE.
            const issued = await exportDischargeLeafletPdf({
                patientId,
                additionalNotes: additionalNotes.trim() || undefined,
                referralNotes: referralNotes.trim() || undefined,
                preview: false,
            });
            await finishExportWithSettings({
                format: "pdf",
                title: `${t("discharge.leaflet.export_title")} ${issued.documentNumber ?? ""}`.trim(),
                hint: issued.reprint ? "KOPIE" : t("discharge.leaflet.export_hint"),
                suggestedFilename,
                mime: "application/pdf",
                binaryBody: pdfBase64ToBytes(issued.pdfBase64),
                context: {
                    kind: "discharge_leaflet",
                    format: "pdf",
                    entityId: patientId,
                    documentNumber: issued.documentNumber,
                },
            });
            onClose();
        } catch (e) {
            toast(tp("discharge.leaflet.pdf_failed", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    }, [
        patient,
        patientId,
        additionalNotes,
        referralNotes,
        suggestedFilename,
        t,
        tp,
        toast,
        onClose,
        practiceReadiness.ready,
    ]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t("discharge.leaflet.title")}
            footer={
                <div className="modal-actions" style={{ justifyContent: "flex-end", gap: "var(--space-2)" }}>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="button" variant="primary" onClick={() => void runExport()} disabled={busy || !patient}>
                        {busy ? t("discharge.leaflet.creating") : t("discharge.leaflet.create_pdf")}
                    </Button>
                </div>
            }
        >
            <div className="modal-body stack gap-3" style={{ maxWidth: 520 }}>
                <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.45, margin: 0 }}>
                    {t("discharge.leaflet.intro")}
                </p>
                <label className="stack gap-1" style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{t("discharge.leaflet.referral")}</span>
                    <textarea
                        className="input"
                        rows={3}
                        value={referralNotes}
                        onChange={(e) => setReferralNotes(e.target.value)}
                        placeholder={t("discharge.leaflet.referral_ph")}
                        disabled={busy}
                    />
                </label>
                <label className="stack gap-1" style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{t("discharge.leaflet.extra_notes")}</span>
                    <textarea
                        className="input"
                        rows={3}
                        value={additionalNotes}
                        onChange={(e) => setAdditionalNotes(e.target.value)}
                        placeholder={t("discharge.leaflet.extra_ph")}
                        disabled={busy}
                    />
                </label>
            </div>
            <PracticeReadinessDialog
                open={practiceGuardOpen}
                documentKind="chart"
                result={practiceReadiness}
                onClose={() => setPracticeGuardOpen(false)}
            />
        </Dialog>
    );
}
