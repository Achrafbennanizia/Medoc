import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Textarea, Select } from "../components/ui/input";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { useAuthStore } from "../../models/store/auth-store";
import { listPatienten } from "../../controllers/patient.controller";
import {
    listRezepte,
    createRezept,
    deleteRezept,
    type Rezept,
} from "../../controllers/rezept.controller";
import { validateEprescription, submitEprescription } from "../../controllers/integration.controller";
import { listDokumentVorlagen } from "../../controllers/praxis.controller";
import type { Patient, DokumentVorlage } from "../../models/types";
import { errorMessage, formatDate } from "../../lib/utils";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import {
    MEDIKAMENT_SUGGESTIONS,
    findSuggestion,
    emptyRezeptLine,
    parseRezeptVorlagePayload,
    vorlageItemsToLines,
    type RezeptLine,
} from "../../lib/medikamente";

/**
 * Rezeptverwaltung (FA-REZ-01..05).
 * Pro Patient: Liste, Erstellung, Löschung. Druck/Print via Browser-Druckdialog.
 */
export function RezeptePage() {
    const session = useAuthStore((s) => s.session);
    const toast = useToastStore((s) => s.add);
    const [searchParams, setSearchParams] = useSearchParams();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [patientsError, setPatientsError] = useState<string | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<string>("");
    const [rezepte, setRezepte] = useState<Rezept[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [draft, setDraft] = useState<RezeptLine>(emptyRezeptLine);
    const [draftError, setDraftError] = useState<string | null>(null);
    const [lines, setLines] = useState<RezeptLine[]>([]);
    const [sharedHinweise, setSharedHinweise] = useState("");
    const [creating, setCreating] = useState(false);
    const [medFilter, setMedFilter] = useState("");
    const [vorlagen, setVorlagen] = useState<DokumentVorlage[]>([]);
    const [vorlageId, setVorlageId] = useState("");

    const loadPatients = useCallback(async () => {
        setPatientsLoading(true);
        setPatientsError(null);
        try {
            const ps = await listPatienten();
            setPatients(ps);
            setSelectedPatient((prev) => prev || (ps[0]?.id ?? ""));
        } catch (e) {
            setPatientsError(errorMessage(e));
            setPatients([]);
            setSelectedPatient("");
        } finally {
            setPatientsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPatients();
    }, [loadPatients]);

    useEffect(() => {
        const pid = searchParams.get("patient_id");
        if (!pid || patients.length === 0) return;
        const exists = patients.some((p) => p.id === pid);
        if (exists) {
            setSelectedPatient(pid);
        } else {
            toast("Der verknüpfte Patient wurde nicht gefunden.", "error");
        }
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("patient_id");
            return next;
        }, { replace: true });
    }, [patients, searchParams, setSearchParams, toast]);

    const fetchRezepte = useCallback(async () => {
        if (!selectedPatient) {
            setRezepte([]);
            setListError(null);
            setListLoading(false);
            return;
        }
        setListLoading(true);
        setListError(null);
        try {
            setRezepte(await listRezepte(selectedPatient));
        } catch (e) {
            setListError(errorMessage(e));
            setRezepte([]);
        } finally {
            setListLoading(false);
        }
    }, [selectedPatient]);

    useEffect(() => {
        void fetchRezepte();
    }, [fetchRezepte]);

    function resetCreateForm() {
        setDraft(emptyRezeptLine());
        setDraftError(null);
        setLines([]);
        setSharedHinweise("");
        setVorlageId("");
    }

    useEffect(() => {
        if (!showCreate || vorlagen.length > 0) return;
        let cancelled = false;
        void listDokumentVorlagen()
            .then((all) => {
                if (cancelled) return;
                setVorlagen(all.filter((v) => v.kind === "REZEPT"));
            })
            .catch(() => {
                if (!cancelled) setVorlagen([]);
            });
        return () => { cancelled = true; };
    }, [showCreate, vorlagen.length]);

    function applyVorlage(id: string) {
        setVorlageId(id);
        if (!id) return;
        const v = vorlagen.find((x) => x.id === id);
        if (!v) return;
        const items = parseRezeptVorlagePayload(v.payload);
        const newLines = vorlageItemsToLines(items);
        if (newLines.length === 0) {
            toast("Vorlage enthält keine Medikamente.", "error");
            return;
        }
        setLines((prev) => [...prev, ...newLines]);
        setDraftError(null);
        toast(`Vorlage „${v.titel}“ übernommen (${newLines.length} Zeile${newLines.length === 1 ? "" : "n"}).`);
    }

    function pickMedikament(label: string) {
        const sugg = findSuggestion(label);
        setDraft((prev) => ({
            ...prev,
            medikament: label,
            wirkstoff: prev.wirkstoff || sugg?.wirkstoff || "",
            dosierung: prev.dosierung || sugg?.dosierung || "",
        }));
    }

    function validateLine(line: RezeptLine): string | null {
        if (!line.medikament.trim()) return "Bitte Medikament wählen oder eingeben.";
        if (!line.dosierung.trim()) return "Bitte Dosierung angeben.";
        if (!line.dauer.trim()) return "Bitte Dauer angeben.";
        return null;
    }

    function handleAddLine() {
        const err = validateLine(draft);
        if (err) {
            setDraftError(err);
            return;
        }
        setLines((prev) => [...prev, { ...draft }]);
        setDraft(emptyRezeptLine());
        setDraftError(null);
    }

    function removeLine(idx: number) {
        setLines((prev) => prev.filter((_, i) => i !== idx));
    }

    async function handleCreate() {
        if (!selectedPatient || !session) return;
        const queue: RezeptLine[] = [...lines];
        if (validateLine(draft) === null) {
            queue.push({ ...draft });
        }
        if (queue.length === 0) {
            setDraftError("Mindestens eine Medikamentenzeile hinzufügen.");
            return;
        }
        setCreating(true);
        let okCount = 0;
        const created: Rezept[] = [];
        try {
            for (const line of queue) {
                const merged = [line.hinweise, sharedHinweise].filter((s) => s.trim()).join(" · ");
                const r = await createRezept({
                    patient_id: selectedPatient,
                    arzt_id: session.user_id,
                    medikament: line.medikament.trim(),
                    wirkstoff: line.wirkstoff.trim() || null,
                    dosierung: line.dosierung.trim(),
                    dauer: line.dauer.trim(),
                    hinweise: merged.trim() || null,
                });
                created.push(r);
                okCount += 1;
            }
            toast(`${okCount} Rezept${okCount === 1 ? "" : "e"} erstellt`);
            setShowCreate(false);
            resetCreateForm();
            await fetchRezepte();
            if (created.length > 1) {
                printCombo(created);
            }
        } catch (e) {
            toast(`${okCount > 0 ? `${okCount} angelegt, dann ` : ""}Fehler: ${errorMessage(e)}`, "error");
            await fetchRezepte();
        } finally {
            setCreating(false);
        }
    }

    const filteredRezepte = useMemo(() => {
        const q = medFilter.trim().toLowerCase();
        if (!q) return rezepte;
        return rezepte.filter(
            (r) =>
                r.medikament.toLowerCase().includes(q)
                || (r.wirkstoff?.toLowerCase().includes(q) ?? false),
        );
    }, [rezepte, medFilter]);

    const [kpi, setKpi] = useState({ weekCount: 0, pending: 0, pct: 0 });
    useEffect(() => {
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        let weekCount = 0;
        for (const r of rezepte) {
            const t = new Date(r.ausgestellt_am).getTime();
            if (!Number.isNaN(t) && now - t <= weekMs) weekCount += 1;
        }
        const pending = rezepte.filter((r) => r.status !== "AUSGESTELLT").length;
        const issued = rezepte.filter((r) => r.status === "AUSGESTELLT").length;
        const pct = rezepte.length === 0 ? 0 : Math.round((issued / rezepte.length) * 100);
        setKpi({ weekCount, pending, pct });
    }, [rezepte]);

    async function handleDelete() {
        if (!deleteId) return;
        try {
            await deleteRezept(deleteId);
            toast("Rezept gelöscht");
            setDeleteId(null);
            await fetchRezepte();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`);
        }
    }

    /* ─── e-Rezept (FA-INT, FA-REZ-08) ────────────────────────────────── */
    const [eRezeptTarget, setERezeptTarget] = useState<Rezept | null>(null);
    const [eRez, setERez] = useState({ kvnr: "", pzn: "", lanr: "", quantity: "1" });
    const [eRezBusy, setERezBusy] = useState(false);

    function openERezeptDialog(r: Rezept) {
        setERezeptTarget(r);
        // Prefill best-guesses; user must confirm KVNR/LANR before submission.
        setERez({ kvnr: "", pzn: "", lanr: "", quantity: "1" });
    }

    async function handleValidateERezept() {
        if (!eRezeptTarget) return;
        setERezBusy(true);
        try {
            await validateEprescription({
                patient_id: eRezeptTarget.patient_id,
                kvnr: eRez.kvnr.trim().toUpperCase(),
                pzn: eRez.pzn.trim(),
                medication_name: eRezeptTarget.medikament,
                dosage: eRezeptTarget.dosierung,
                quantity: Number(eRez.quantity) || 1,
                doctor_lanr: eRez.lanr.trim(),
                issued_at: eRezeptTarget.ausgestellt_am.slice(0, 10),
            });
            toast("E-Rezept-Daten gültig (PZN/KVNR/LANR)", "success");
        } catch (e) {
            toast(`E-Rezept-Validierung fehlgeschlagen: ${errorMessage(e)}`);
        } finally {
            setERezBusy(false);
        }
    }

    async function handleSubmitERezept() {
        if (!eRezeptTarget) return;
        setERezBusy(true);
        try {
            const token = await submitEprescription({
                patient_id: eRezeptTarget.patient_id,
                kvnr: eRez.kvnr.trim().toUpperCase(),
                pzn: eRez.pzn.trim(),
                medication_name: eRezeptTarget.medikament,
                dosage: eRezeptTarget.dosierung,
                quantity: Number(eRez.quantity) || 1,
                doctor_lanr: eRez.lanr.trim(),
                issued_at: eRezeptTarget.ausgestellt_am.slice(0, 10),
            });
            toast(`An TI gesendet — Task ${token.task_id}`, "success");
            setERezeptTarget(null);
        } catch (e) {
            // Backend currently returns "TI-Konnektor erforderlich" — surface verbatim.
            toast(`TI-Übermittlung: ${errorMessage(e)}`, "info");
        } finally {
            setERezBusy(false);
        }
    }

    function escapeHtml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function renderRezeptBlock(r: Rezept): string {
        return `<section class="rx">
            <div class="row"><span class="label">Medikament:</span><strong>${escapeHtml(r.medikament)}</strong></div>
            ${r.wirkstoff ? `<div class="row"><span class="label">Wirkstoff:</span>${escapeHtml(r.wirkstoff)}</div>` : ""}
            <div class="row"><span class="label">Dosierung:</span>${escapeHtml(r.dosierung)}</div>
            <div class="row"><span class="label">Dauer:</span>${escapeHtml(r.dauer)}</div>
            ${r.hinweise ? `<div class="row"><span class="label">Hinweise:</span>${escapeHtml(r.hinweise)}</div>` : ""}
        </section>`;
    }

    function openPrintWindow(title: string, patient: Patient | undefined, datum: string, body: string) {
        const w = window.open("", "_blank", "width=620,height=820");
        if (!w) return;
        w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
            <style>body{font-family:Helvetica,Arial,sans-serif;padding:2cm;color:#000}
            h1{font-size:18pt;margin-bottom:0.4cm}h2{font-size:13pt;margin:0.4cm 0 0.2cm;color:#333}
            .row{margin:0.25cm 0}.label{display:inline-block;width:4cm;color:#555}
            .rx{border-top:1px solid #ddd;padding-top:0.4cm;margin-top:0.4cm}
            .rx:first-of-type{border-top:none;margin-top:0;padding-top:0}</style>
            </head><body>
            <h1>${escapeHtml(title)}</h1>
            <div class="row"><span class="label">Patient:</span>${escapeHtml(patient?.name ?? "")}</div>
            <div class="row"><span class="label">Geburtsdatum:</span>${patient ? escapeHtml(formatDate(patient.geburtsdatum)) : ""}</div>
            <div class="row"><span class="label">Datum:</span>${escapeHtml(datum)}</div>
            <hr/>
            ${body}
            <p style="margin-top:3cm">______________________<br/>Unterschrift Ärztin/Arzt</p>
            <script>window.print();</script></body></html>`);
        w.document.close();
    }

    function handlePrint(r: Rezept) {
        const patient = patients.find((p) => p.id === r.patient_id);
        openPrintWindow("Rezept", patient, formatDate(r.ausgestellt_am), renderRezeptBlock(r));
    }

    function printCombo(items: Rezept[]) {
        if (items.length === 0) return;
        const first = items[0]!;
        const patient = patients.find((p) => p.id === first.patient_id);
        const body = items.map(renderRezeptBlock).join("");
        const title = items.length === 1 ? "Rezept" : `Kombinationsrezept (${items.length})`;
        openPrintWindow(title, patient, formatDate(first.ausgestellt_am), body);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="page-head">
                <div>
                    <h2 className="page-title">Rezepte & Atteste</h2>
                    <div className="page-sub">{filteredRezepte.length} von {rezepte.length} Rezepten · Atteste über Atteste-Seite</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <div className="input" style={{ width: "min(220px, 100%)", flex: "1 1 220px" }}>
                        <input
                            placeholder="Medikament filtern…"
                            value={medFilter}
                            onChange={(e) => setMedFilter(e.target.value)}
                            aria-label="Rezepte nach Medikament filtern"
                        />
                    </div>
                    {medFilter ? (
                        <Button variant="ghost" onClick={() => setMedFilter("")}>Filter löschen</Button>
                    ) : null}
                    <Button onClick={() => setShowCreate(true)} disabled={!selectedPatient}>+ Neues Rezept</Button>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                <div className="card kpi"><div className="kpi-label">Ausgestellt (7 Tage)</div><div className="kpi-val">{kpi.weekCount}</div></div>
                <div className="card kpi"><div className="kpi-label">Nicht ausgestellt / offen</div><div className="kpi-val">{kpi.pending}</div></div>
                <div className="card kpi"><div className="kpi-label">Status „ausgestellt“</div><div className="kpi-val">{kpi.pct}%</div></div>
            </div>

            <Card className="card-pad">
                <CardHeader title="Patient auswählen" />
                {patientsLoading ? (
                    <p className="text-body text-on-surface-variant" role="status">Patienten werden geladen…</p>
                ) : patientsError ? (
                    <PageLoadError message={patientsError} onRetry={() => void loadPatients()} />
                ) : (
                    <Select
                        id="rez-patient"
                        value={selectedPatient}
                        onChange={(e) => setSelectedPatient(e.target.value)}
                        disabled={patients.length === 0}
                        options={[
                            ...(patients.length === 0
                                ? [{ value: "", label: "Keine Patienten angelegt" }]
                                : [{ value: "", label: "– Patient wählen –" }]),
                            ...patients.map((p) => ({ value: p.id, label: p.name })),
                        ]}
                    />
                )}
            </Card>

            {patientsLoading || patientsError ? null : !selectedPatient ? (
                <p className="text-body text-on-surface-variant">Bitte einen Patienten auswählen.</p>
            ) : listLoading ? (
                <PageLoading label="Rezepte werden geladen…" />
            ) : listError ? (
                <PageLoadError message={listError} onRetry={() => void fetchRezepte()} />
            ) : rezepte.length === 0 ? (
                <EmptyState icon="💊" title="Keine Rezepte vorhanden" />
            ) : filteredRezepte.length === 0 ? (
                <EmptyState icon="🔍" title="Keine Treffer für den Filter" description='Filter löschen oder Suchbegriff anpassen.' />
            ) : (
                <div className="card">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Medikament</th><th>Dosierung</th><th>Dauer</th><th>Datum</th><th>Status</th><th>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRezepte.map((r) => (
                                <tr key={r.id}>
                                    <td>{r.medikament}</td>
                                    <td>{r.dosierung}</td>
                                    <td>{r.dauer}</td>
                                    <td>{formatDate(r.ausgestellt_am)}</td>
                                    <td>{r.status}</td>
                                    <td className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                        <Button size="sm" onClick={() => handlePrint(r)}>Drucken</Button>
                                        <Button size="sm" variant="ghost" onClick={() => openERezeptDialog(r)}>e-Rezept</Button>
                                        <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>Löschen</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog
                open={showCreate}
                onClose={() => { if (!creating) { setShowCreate(false); resetCreateForm(); } }}
                title="Neues Rezept (Kombinationsrezept möglich)"
                footer={<>
                    <Button variant="ghost" onClick={() => { setShowCreate(false); resetCreateForm(); }} disabled={creating}>Abbrechen</Button>
                    <Button
                        onClick={() => void handleCreate()}
                        disabled={creating || (lines.length === 0 && validateLine(draft) !== null)}
                    >
                        {creating
                            ? "Wird gespeichert…"
                            : lines.length + (validateLine(draft) === null ? 1 : 0) > 1
                                ? `${lines.length + (validateLine(draft) === null ? 1 : 0)} Rezepte erstellen`
                                : "Rezept erstellen"}
                    </Button>
                </>}
            >
                <datalist id="rez-med-suggestions">
                    {MEDIKAMENT_SUGGESTIONS.map((s) => (
                        <option key={s.label} value={s.label} />
                    ))}
                </datalist>

                <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 0, marginBottom: 8 }}>
                    Mehrere Medikamente können kaskadierend hinzugefügt werden – jede Zeile wird als eigenständiges Rezept gespeichert
                    und beim Speichern automatisch als Kombinationsrezept gedruckt.
                </p>

                {vorlagen.length > 0 ? (
                    <div style={{ marginBottom: 12 }}>
                        <Select
                            id="rez-vorlage"
                            label="Vorlage übernehmen (optional)"
                            value={vorlageId}
                            onChange={(e) => applyVorlage(e.target.value)}
                            options={[
                                { value: "", label: "— Vorlage wählen —" },
                                ...vorlagen.map((v) => ({ value: v.id, label: v.titel })),
                            ]}
                        />
                        <p style={{ fontSize: 11, color: "var(--fg-3)", margin: "4px 0 0" }}>
                            Vorlagen aus „Verwaltung → Rezepte und Atteste vordefinieren“. Übernommene Zeilen werden zur Liste unten hinzugefügt.
                        </p>
                    </div>
                ) : null}

                <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Neue Zeile</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Input
                            id="rez-med"
                            label="Medikament *"
                            list="rez-med-suggestions"
                            placeholder="z. B. Ibuprofen 600 mg"
                            value={draft.medikament}
                            onChange={(e) => pickMedikament(e.target.value)}
                            error={draftError && !draft.medikament.trim() ? draftError : undefined}
                        />
                        <Input
                            id="rez-wirk"
                            label="Wirkstoff"
                            value={draft.wirkstoff}
                            onChange={(e) => setDraft({ ...draft, wirkstoff: e.target.value })}
                        />
                        <Input
                            id="rez-dos"
                            label="Dosierung *"
                            value={draft.dosierung}
                            onChange={(e) => setDraft({ ...draft, dosierung: e.target.value })}
                            placeholder="z. B. 1-0-1"
                            error={draftError && !draft.dosierung.trim() ? draftError : undefined}
                        />
                        <Input
                            id="rez-dau"
                            label="Dauer *"
                            value={draft.dauer}
                            onChange={(e) => setDraft({ ...draft, dauer: e.target.value })}
                            placeholder="z. B. 7 Tage"
                            error={draftError && !draft.dauer.trim() ? draftError : undefined}
                        />
                    </div>
                    <Textarea
                        id="rez-hin"
                        label="Hinweise (Zeile)"
                        value={draft.hinweise}
                        onChange={(e) => setDraft({ ...draft, hinweise: e.target.value })}
                        rows={2}
                    />
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                        <Button type="button" variant="secondary" onClick={handleAddLine} disabled={creating}>
                            + Hinzufügen
                        </Button>
                    </div>
                </div>

                <Textarea
                    id="rez-shared-hinweise"
                    label="Allgemeine Hinweise (für alle Zeilen)"
                    value={sharedHinweise}
                    onChange={(e) => setSharedHinweise(e.target.value)}
                    rows={2}
                />

                <div style={{ marginTop: 12, border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                        Zeilen ({lines.length})
                    </div>
                    {lines.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", fontSize: 13, margin: 0 }}>
                            Noch keine Medikamente. Mindestens eine Zeile muss vorhanden sein – die obige Eingabe wird beim Speichern automatisch übernommen.
                        </p>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {lines.map((line, idx) => (
                                <li
                                    key={`${line.medikament}-${idx}`}
                                    className="row"
                                    style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}
                                >
                                    <div style={{ fontSize: 13 }}>
                                        <strong>{line.medikament}</strong>
                                        {line.wirkstoff ? ` (${line.wirkstoff})` : ""}
                                        {" — "}
                                        {line.dosierung}
                                        {" · "}
                                        {line.dauer}
                                        {line.hinweise ? ` · ${line.hinweise}` : ""}
                                    </div>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(idx)} disabled={creating}>
                                        Entfernen
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Dialog>

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Rezept löschen"
                message="Möchten Sie dieses Rezept wirklich löschen?"
                confirmLabel="Löschen"
                danger
            />

            <Dialog
                open={!!eRezeptTarget}
                onClose={() => setERezeptTarget(null)}
                title={`E-Rezept – ${eRezeptTarget?.medikament ?? ""}`}
                footer={<>
                    <Button variant="ghost" onClick={() => setERezeptTarget(null)} disabled={eRezBusy}>Schließen</Button>
                    <Button variant="secondary" onClick={() => void handleValidateERezept()} disabled={eRezBusy} loading={eRezBusy}>Validieren</Button>
                    <Button onClick={() => void handleSubmitERezept()} disabled={eRezBusy} loading={eRezBusy}>An TI senden</Button>
                </>}
            >
                <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 0 8px" }}>
                    Eingaben werden nur lokal validiert (PZN-Prüfziffer, KVNR-/LANR-Format). Der eigentliche Versand
                    via Telematikinfrastruktur erfordert HBA-Karte und Konnektor.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Input id="er-kvnr" label="KVNR (1 Buchstabe + 9 Ziffern)" value={eRez.kvnr} onChange={(e) => setERez({ ...eRez, kvnr: e.target.value })} placeholder="A123456789" />
                    <Input id="er-pzn" label="PZN (8 Ziffern)" value={eRez.pzn} onChange={(e) => setERez({ ...eRez, pzn: e.target.value })} placeholder="12345678" />
                    <Input id="er-lanr" label="LANR (9 Ziffern)" value={eRez.lanr} onChange={(e) => setERez({ ...eRez, lanr: e.target.value })} placeholder="123456789" />
                    <Input id="er-qty" label="Menge" type="number" value={eRez.quantity} onChange={(e) => setERez({ ...eRez, quantity: e.target.value })} />
                </div>
            </Dialog>
        </div>
    );
}
