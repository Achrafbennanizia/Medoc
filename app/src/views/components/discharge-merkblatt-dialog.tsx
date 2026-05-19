import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import type { Patient } from "@/models/types";
import { exportDischargeMerkblattPdf } from "@/controllers/akte.controller";
import { finishExportWithSettings } from "@/lib/export";
import { slugPatientName } from "@/lib/akte-export";
import { useToastStore } from "./ui/toast-store";

export type DischargeMerkblattDialogProps = {
    open: boolean;
    onClose: () => void;
    patientId: string;
    patient: Patient | null;
};

export function DischargeMerkblattDialog({ open, onClose, patientId, patient }: DischargeMerkblattDialogProps) {
    const toast = useToastStore((s) => s.add);
    const [zusatzHinweise, setZusatzHinweise] = useState("");
    const [ueberweisungHinweise, setUeberweisungHinweise] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setZusatzHinweise("");
            setUeberweisungHinweise("");
            setBusy(false);
        }
    }, [open]);

    const suggestedFilename = useMemo(() => {
        if (!patient) return "Entlassungs-Merkblatt.pdf";
        const slug = slugPatientName(patient.name);
        const ymd = new Date().toISOString().slice(0, 10);
        return `Entlassungs-Merkblatt-${slug}-${ymd}.pdf`;
    }, [patient]);

    const runExport = useCallback(async () => {
        if (!patient) {
            toast("Keine Patientendaten geladen.", "error");
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
                title: "Entlassungs-Merkblatt / Nachsorge",
                hint: "FA-DOK-08 — kompakte Zusammenfassung für den Patienten.",
                suggestedFilename,
                mime: "application/pdf",
                binaryBody: bytes,
            });
            onClose();
        } catch (e) {
            toast(`PDF konnte nicht erstellt werden: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setBusy(false);
        }
    }, [
        patient,
        patientId,
        zusatzHinweise,
        ueberweisungHinweise,
        suggestedFilename,
        toast,
        onClose,
    ]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Entlassungs-Merkblatt (PDF)"
            footer={
                <div className="modal-actions" style={{ justifyContent: "flex-end", gap: 8 }}>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                        Abbrechen
                    </Button>
                    <Button type="button" variant="primary" onClick={() => void runExport()} disabled={busy || !patient}>
                        {busy ? "Erstellt…" : "PDF erstellen"}
                    </Button>
                </div>
            }
        >
            <div className="modal-body stack gap-3" style={{ maxWidth: 520 }}>
                <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.45, margin: 0 }}>
                    Enthält Stammdaten, die letzte dokumentierte Behandlung, einen Auszug der Rezepte sowie den nächsten Termin.
                    Freitextfelder sind optional.
                </p>
                <label className="stack gap-1" style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Überweisung / weiterführende Versorgung</span>
                    <textarea
                        className="input"
                        rows={3}
                        value={ueberweisungHinweise}
                        onChange={(e) => setUeberweisungHinweise(e.target.value)}
                        placeholder="z. B. Überweisung an …"
                        disabled={busy}
                    />
                </label>
                <label className="stack gap-1" style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Zusätzliche Hinweise / Nachsorge</span>
                    <textarea
                        className="input"
                        rows={3}
                        value={zusatzHinweise}
                        onChange={(e) => setZusatzHinweise(e.target.value)}
                        placeholder="z. B. Mundhygiene, Kontrolltermin …"
                        disabled={busy}
                    />
                </label>
            </div>
        </Dialog>
    );
}
