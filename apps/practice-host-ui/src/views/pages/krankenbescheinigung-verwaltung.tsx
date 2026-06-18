import { useState } from "react";
import { useAuthStore } from "@/models/store/auth-store";
import { useToastStore } from "@/views/components/ui/toast-store";
import { Button } from "@/views/components/ui/button";
import { krankenbescheinigungSave } from "@/systems/practice-host/controllers/krankenbescheinigung.controller";
import { saveKrankenbescheinigungAtomic } from "@/lib/krankenbescheinigung-orchestrator";
import { errorMessage } from "@/lib/utils";

/** Krankenbescheinigung breaks — sick-but-can-work workflow with document attachment. */
export function KrankenbescheinigungFormPage() {
    const personalId = useAuthStore((s) => s.session?.user_id ?? "");
    const toast = useToastStore((s) => s.add);
    const [note, setNote] = useState("");
    const [docName, setDocName] = useState("");
    const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
    const [busy, setBusy] = useState(false);

    async function handleSave() {
        if (!docName.trim() || !personalId) return;
        setBusy(true);
        try {
            const result = await saveKrankenbescheinigungAtomic(
                async (input) => {
                    const rec = await krankenbescheinigungSave({
                        personalId: input.personalId,
                        note: input.note || null,
                        documentRef: input.documentRef,
                        dateFrom: input.dateFrom,
                        dateTo: input.dateTo ?? null,
                    });
                    return { id: rec.id };
                },
                {
                    personalId,
                    note: note.trim(),
                    documentRef: docName.trim(),
                    dateFrom,
                },
            );
            toast(
                `Gespeichert — ${result.cancelledBlockCount} Arbeitsplan-Block/Blöcke storniert (lokal + Server-Sync).`,
                "success",
            );
            setNote("");
            setDocName("");
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="praxis-workspace-page animate-fade-in" style={{ maxWidth: 720 }}>
            <h1 className="card-title">Krankenbescheinigung erfassen</h1>
            <p className="card-sub" style={{ marginBottom: 16 }}>
                Dokument anhängen und passenden Anteil im Arbeitsplan stornieren (Workflow getrennt von AU/Attest).
            </p>
            <label style={{ display: "block", marginBottom: 12 }}>
                Von (Datum)
                <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={{ width: "100%", marginTop: 4 }}
                />
            </label>
            <label style={{ display: "block", marginBottom: 12 }}>
                Bemerkung
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    style={{ width: "100%", marginTop: 4 }}
                />
            </label>
            <label style={{ display: "block", marginBottom: 16 }}>
                Dokument (Pflicht)
                <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Pfad oder Dateiname"
                    style={{ width: "100%", marginTop: 4 }}
                />
            </label>
            <Button
                type="button"
                disabled={!docName.trim() || !personalId || busy}
                loading={busy}
                onClick={() => void handleSave()}
            >
                Speichern
            </Button>
        </div>
    );
}
