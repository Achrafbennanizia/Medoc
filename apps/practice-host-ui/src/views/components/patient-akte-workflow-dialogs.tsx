import { useCallback, useEffect, useState } from "react";
import { forwardAkteToPhysicians } from "@/systems/practice-host/controllers/akte-workflow.controller";
import {
    createPraxisAufgabe,
    type PraxisAufgabeTyp,
} from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { listAerzte, listPersonal, type AerztSummary } from "@/systems/practice-host/controllers/personal.controller";
import { errorMessage } from "@/lib/utils";
import type { Role } from "@/lib/rbac";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Select, Textarea } from "./ui/input";

export type PatientAkteWorkflowMode = "ticket" | "forward" | "aufgabe" | null;

const AUFGABE_TYP_OPTS: { value: PraxisAufgabeTyp; label: string }[] = [
    { value: "ABRECHNUNG", label: "Abrechnung" },
    { value: "TERMIN", label: "Termin" },
    { value: "DRUCK", label: "Druck" },
    { value: "STAMMDATEN", label: "Stammdaten" },
    { value: "SONSTIGES", label: "Sonstiges" },
];

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

    const [aufgabeTyp, setAufgabeTyp] = useState<PraxisAufgabeTyp>("SONSTIGES");
    const [aufgabeTitel, setAufgabeTitel] = useState("");
    const [aufgabeBody, setAufgabeBody] = useState("");
    const [aufgabeRezId, setAufgabeRezId] = useState("");
    const [rezeption, setRezeption] = useState<{ id: string; name: string }[]>([]);

    const loadAerzte = useCallback(async () => {
        setLoadErr(null);
        try {
            const [list, personal] = await Promise.all([listAerzte(), listPersonal()]);
            setAerzte(list);
            const rezList = personal
                .filter((p) => p.rolle === "REZEPTION")
                .map((p) => ({ id: p.id, name: p.name }));
            setRezeption(rezList);
            if (list.length > 0) {
                setTicketArztId((prev) => (list.some((a) => a.id === prev) ? prev : list[0]!.id));
            }
            if (rezList.length > 0) {
                setAufgabeRezId((prev) => (rezList.some((r) => r.id === prev) ? prev : rezList[0]!.id));
            } else {
                setAufgabeRezId("");
            }
        } catch (e) {
            setLoadErr(errorMessage(e));
            setAerzte([]);
            setRezeption([]);
        }
    }, []);

    useEffect(() => {
        if (!mode) return;
        void loadAerzte();
        setTicketBody("");
        setForwardNote("");
        setForwardIds({});
        setAufgabeTyp("SONSTIGES");
        setAufgabeTitel("");
        setAufgabeBody("");
        setAufgabeRezId("");
    }, [mode, loadAerzte]);

    const submitTicket = async () => {
        const body = ticketBody.trim();
        if (!ticketArztId || !body) {
            toast("Arzt und Nachricht ausfüllen.", "error");
            return;
        }
        setBusy(true);
        try {
            const titel = body.length > 80 ? `${body.slice(0, 77)}…` : body;
            await createPraxisAufgabe({
                patientId,
                typ: "SONSTIGES",
                titel,
                body,
                assigneeUserId: ticketArztId,
            });
            toast("Aufgabe an Arzt erstellt.", "success");
            onClose();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const submitAufgabe = async () => {
        const titel = aufgabeTitel.trim();
        if (!titel) {
            toast("Titel ausfüllen.", "error");
            return;
        }
        setBusy(true);
        try {
            await createPraxisAufgabe({
                patientId,
                typ: aufgabeTyp,
                titel,
                body: aufgabeBody.trim() || null,
                assigneeUserId: aufgabeRezId.trim() || null,
                assigneeRole: aufgabeRezId.trim() ? null : "REZEPTION",
            });
            toast(
                aufgabeRezId.trim()
                    ? "Private Aufgabe an Rezeption gesendet."
                    : "Aufgabe an Rezeption (Pool) erstellt.",
                "success",
            );
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
    if (mode === "aufgabe" && role !== "ARZT") return null;
    if (mode === "forward" && role !== "ARZT" && role !== "REZEPTION") return null;

    return (
        <>
            <Dialog
                open={mode === "ticket"}
                onClose={onClose}
                title="Aufgabe an Arzt"
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
                    <p className="page-sub" style={{ margin: 0 }}>
                        Nur Sie und der gewählte Arzt sehen diese Aufgabe (wie ein Chat).
                    </p>
                </div>
            </Dialog>

            <Dialog
                open={mode === "aufgabe"}
                onClose={onClose}
                title="Aufgabe an Rezeption"
                footer={(
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                            Abbrechen
                        </Button>
                        <Button type="button" variant="primary" onClick={() => void submitAufgabe()} disabled={busy}>
                            {busy ? "Senden…" : "Anlegen"}
                        </Button>
                    </div>
                )}
            >
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p className="page-sub" style={{ margin: 0 }}>
                        Wählen Sie eine Person für eine private Aufgabe — oder „Rezeption (Pool)“ für alle an der Rezeption.
                    </p>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">Empfänger</span>
                        <Select
                            value={aufgabeRezId || "__pool__"}
                            onChange={(e) => setAufgabeRezId(e.target.value === "__pool__" ? "" : e.target.value)}
                            options={[
                                { value: "__pool__", label: "Rezeption (Pool — alle)" },
                                ...rezeption.map((r) => ({ value: r.id, label: r.name })),
                            ]}
                        />
                    </label>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">Typ</span>
                        <Select
                            value={aufgabeTyp}
                            onChange={(e) => setAufgabeTyp(e.target.value as PraxisAufgabeTyp)}
                            options={AUFGABE_TYP_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                        />
                    </label>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">Titel *</span>
                        <input
                            className="input"
                            value={aufgabeTitel}
                            onChange={(e) => setAufgabeTitel(e.target.value)}
                            placeholder="z. B. Termin vereinbaren"
                        />
                    </label>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">Beschreibung</span>
                        <Textarea
                            rows={3}
                            value={aufgabeBody}
                            onChange={(e) => setAufgabeBody(e.target.value)}
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
