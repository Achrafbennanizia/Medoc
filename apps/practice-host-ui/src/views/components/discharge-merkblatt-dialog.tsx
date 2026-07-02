import { useT, useTParams } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import type { Patient } from "@/models/types";
import { exportDischargeMerkblattPdf } from "@/systems/practice-host/controllers/akte.controller";
import { finishExportWithSettings } from "@/lib/export";
import { slugPatientName } from "@/lib/akte-export";
import { useToastStore } from "./ui/toast-store";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import { checkPraxisDocumentReadiness } from "@/lib/praxis-completeness";
import { PraxisReadinessDialog } from "./praxis-readiness-dialog";

export type DischargeMerkblattDialogProps = {
    open: boolean;
    onClose: () => void;
    patientId: string;
    patient: Patient | null;
};

export function DischargeMerkblattDialog({ open, onClose, patientId, patient }: DischargeMerkblattDialogProps) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [zusatzHinweise, setZusatzHinweise] = useState("");
    const [ueberweisungHinweise, setUeberweisungHinweise] = useState("");
    const [busy, setBusy] = useState(false);
    const [praxisGuardOpen, setPraxisGuardOpen] = useState(false);
    const praxisReadiness = checkPraxisDocumentReadiness(getInvoicePraxisFromStorage(), "akte");

    useEffect(() => {
        if (!open) {
            setZusatzHinweise("");
            setUeberweisungHinweise("");
            setBusy(false);
        }
    }, [open]);

    const suggestedFilename = useMemo(() => {
        if (!patient) return t("discharge.merkblatt.filename");
        const slug = slugPatientName(patient.name);
        const ymd = new Date().toISOString().slice(0, 10);
        const base = t("discharge.merkblatt.filename").replace(/\.pdf$/i, "");
        return `${base}-${slug}-${ymd}.pdf`;
    }, [patient, t]);

    const runExport = useCallback(async () => {
        if (!patient) {
            toast(t("export.picker.no_patient"), "error");
            return;
        }
        if (!praxisReadiness.ready) {
            setPraxisGuardOpen(true);
            return;
        }
        setBusy(true);
        try {
            const b64 = await exportDischargeMerkblattPdf({
                patientId,
                zusatzHinweise: zusatzHinweise.trim() || undefined,
                ueberweisungHinweise: ueberweisungHinweise.trim() || undefined,
            });
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            await finishExportWithSettings({
                format: "pdf",
                title: t("discharge.merkblatt.export_title"),
                hint: t("discharge.merkblatt.export_hint"),
                suggestedFilename,
                mime: "application/pdf",
                binaryBody: bytes,
            });
            onClose();
        } catch (e) {
            toast(tp("discharge.merkblatt.pdf_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
        } finally {
            setBusy(false);
        }
    }, [
        patient,
        patientId,
        zusatzHinweise,
        ueberweisungHinweise,
        suggestedFilename,
        t,
        tp,
        toast,
        onClose,
        praxisReadiness.ready,
    ]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t("discharge.merkblatt.title")}
            footer={
                <div className="modal-actions" style={{ justifyContent: "flex-end", gap: 8 }}>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="button" variant="primary" onClick={() => void runExport()} disabled={busy || !patient}>
                        {busy ? t("discharge.merkblatt.creating") : t("discharge.merkblatt.create_pdf")}
                    </Button>
                </div>
            }
        >
            <div className="modal-body stack gap-3" style={{ maxWidth: 520 }}>
                <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.45, margin: 0 }}>
                    {t("discharge.merkblatt.intro")}
                </p>
                <label className="stack gap-1" style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{t("discharge.merkblatt.referral")}</span>
                    <textarea
                        className="input"
                        rows={3}
                        value={ueberweisungHinweise}
                        onChange={(e) => setUeberweisungHinweise(e.target.value)}
                        placeholder={t("discharge.merkblatt.referral_ph")}
                        disabled={busy}
                    />
                </label>
                <label className="stack gap-1" style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{t("discharge.merkblatt.extra_notes")}</span>
                    <textarea
                        className="input"
                        rows={3}
                        value={zusatzHinweise}
                        onChange={(e) => setZusatzHinweise(e.target.value)}
                        placeholder={t("discharge.merkblatt.extra_ph")}
                        disabled={busy}
                    />
                </label>
            </div>
            <PraxisReadinessDialog
                open={praxisGuardOpen}
                documentKind="akte"
                result={praxisReadiness}
                onClose={() => setPraxisGuardOpen(false)}
            />
        </Dialog>
    );
}
