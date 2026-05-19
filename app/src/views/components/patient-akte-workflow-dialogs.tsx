import { useCallback, useEffect, useState } from "react";
import { createPraxisTicket, forwardAkteToPhysicians } from "@/controllers/akte-workflow.controller";
import { listAerzte, type AerztSummary } from "@/controllers/personal.controller";
import { errorMessage } from "@/lib/utils";
import type { Role } from "@/lib/rbac";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Select, Textarea } from "./ui/input";

export type PatientAkteWorkflowMode = "ticket" | "forward" | null;

type ToastFn = (message: string, variant?: "info" | "error" | "success") => void;

export function PatientAkteWorkflowDialogs(props: {
    mode: PatientAkteWorkflowMode;
    onClose: () => void;
    patientId: string;
    currentUserId: string;
    role: Role;
    toast: ToastFn;
}) {
    const { mode, onClose, patientId, currentUserId, role, toast } = props;
    const [aerzte, setAerzte] = useState<AerztSummary[]>([]);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [ticketArztId, setTicketArztId] = useState("");
    const [ticketBody, setTicketBody] = useState("");

    const [forwardIds, setForwardIds] = useState<Record<string, boolean>>({});
    const [forwardNote, setForwardNote] = useState("");

    const loadAerzte = useCallback(async () => {
        setLoadErr(null);
        try {
            const list = await listAerzte();
            setAerzte(list);
            if (list.length > 0) {
                setTicketArztId((prev) => (list.some((a) => a.id === prev) ? prev : list[0]!.id));
            }
        } catch (e) {
            setLoadErr(errorMessage(e));
            setAerzte([]);
        }
    }, []);

    useEffect(() => {
        if (!mode) return;
        void loadAerzte();
        setTicketBody("");
        setForwardNote("");
        setForwardIds({});
    }, [mode, loadAerzte]);

    const submitTicket = async () => {
        const body = ticketBody.trim();
        if (!ticketArztId || !body) {
            toast("Arzt und Nachricht ausfüllen.", "error");
            return;
        }
        setBusy(true);
        try {
            await createPraxisTicket({ patientId, toArztId: ticketArztId, body });
            toast("Ticket erstellt.", "success");
            onClose();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const submitForward = async () => {
        const ids = Object.entries(forwardIds)
            .filter(([, on]) => on)
            .map(([id]) => id)
            .filter((id) => id && id !== currentUserId);
        if (ids.length === 0) {
            toast("Mindestens einen anderen Arzt auswählen.", "error");
            return;
        }
        setBusy(true);
        try {
            await forwardAkteToPhysicians({
                patientId,
                arztIds: ids,
                message: forwardNote.trim() || null,
            });
            toast("Review angefragt.", "success");
            onClose();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    if (mode === "ticket" && role !== "REZEPTION") return null;
    if (mode === "forward" && role !== "ARZT" && role !== "REZEPTION") return null;

    return (
        <>
            <Dialog
                open={mode === "ticket"}
                onClose={onClose}
                title="Ticket an Arzt"
                footer={(
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                            Abbrechen
                        </Button>
                        <Button type="button" variant="primary" onClick={() => void submitTicket()} disabled={busy || !!loadErr}>
                            {busy ? "Senden…" : "Senden"}
                        </Button>
                    </div>
                )}
            >
                {loadErr ? <p className="page-sub" style={{ color: "var(--danger)" }}>{loadErr}</p> : null}
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">Arzt</span>
                        <Select
                            value={ticketArztId}
                            onChange={(e) => setTicketArztId(e.target.value)}
                            disabled={aerzte.length === 0}
                            options={aerzte.map((a) => ({ value: a.id, label: a.name }))}
                        />
                    </label>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">Nachricht</span>
                        <Textarea
                            rows={4}
                            value={ticketBody}
                            onChange={(e) => setTicketBody(e.target.value)}
                            placeholder="Kurze strukturierte Anfrage an den behandelnden Arzt…"
                        />
                    </label>
                </div>
            </Dialog>

            <Dialog
                open={mode === "forward"}
                onClose={onClose}
                title="Akte — Review anfragen"
                footer={(
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                            Abbrechen
                        </Button>
                        <Button type="button" variant="primary" onClick={() => void submitForward()} disabled={busy || !!loadErr}>
                            {busy ? "Senden…" : "Benachrichtigen"}
                        </Button>
                    </div>
                )}
            >
                {loadErr ? <p className="page-sub" style={{ color: "var(--danger)" }}>{loadErr}</p> : null}
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p className="page-sub" style={{ margin: 0 }}>
                        Ausgewählte Ärzt:innen erhalten eine In-App-Meldung mit Link-Kontext zu dieser Akte.
                    </p>
                    <div className="stack" style={{ gap: 8 }}>
                        {aerzte
                            .filter((a) => a.id !== currentUserId)
                            .map((a) => (
                                <label key={a.id} className="row" style={{ gap: 8, alignItems: "center" }}>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(forwardIds[a.id])}
                                        onChange={(e) => setForwardIds((prev) => ({ ...prev, [a.id]: e.target.checked }))}
                                    />
                                    <span>{a.name}</span>
                                </label>
                            ))}
                    </div>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">Optionaler Hinweis</span>
                        <Textarea rows={3} value={forwardNote} onChange={(e) => setForwardNote(e.target.value)} />
                    </label>
                </div>
            </Dialog>
        </>
    );
}
