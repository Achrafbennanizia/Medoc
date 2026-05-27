import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { listPersonal } from "@/systems/practice-host/controllers/personal.controller";
import {
    createPraxisAufgabeAdmin,
    listPraxisAufgabenAdmin,
    updatePraxisAufgabeAdmin,
    type PraxisAufgabe,
    type PraxisAufgabeStatus,
    type PraxisAufgabeTyp,
} from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import type { Patient, Personal } from "@/models/types";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Input, Select, Textarea } from "../components/ui/input";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { FilterIcon, PlusIcon, SearchIcon } from "@/lib/icons";

const TYPS: readonly { value: PraxisAufgabeTyp; label: string }[] = [
    { value: "ABRECHNUNG", label: "Abrechnung" },
    { value: "TERMIN", label: "Termin" },
    { value: "DRUCK", label: "Druck" },
    { value: "STAMMDATEN", label: "Stammdaten" },
    { value: "SONSTIGES", label: "Sonstiges" },
];

const STATUSES: readonly { value: PraxisAufgabeStatus; label: string }[] = [
    { value: "OFFEN", label: "Offen" },
    { value: "IN_BEARBEITUNG", label: "In Bearbeitung" },
    { value: "ERLEDIGT_REZEPTION", label: "Erledigt (Rezeption)" },
    { value: "VALIDIERT", label: "Validiert" },
    { value: "ZURUECK", label: "Zurück" },
];

type AssigneeMode = "rezeption" | "user";

type TaskForm = {
    patientId: string;
    typ: PraxisAufgabeTyp;
    titel: string;
    body: string;
    assigneeMode: AssigneeMode;
    assigneeUserId: string;
    status: PraxisAufgabeStatus;
};

const emptyForm = (): TaskForm => ({
    patientId: "",
    typ: "SONSTIGES",
    titel: "",
    body: "",
    assigneeMode: "rezeption",
    assigneeUserId: "",
    status: "OFFEN",
});

function assigneeLabel(row: PraxisAufgabe, personal: Personal[]): string {
    if (row.assignee_role === "REZEPTION") return "Rezeption (Pool)";
    if (row.assignee_user_id) {
        const p = personal.find((x) => x.id === row.assignee_user_id);
        return p ? `${p.name} (${p.rolle})` : row.assignee_user_id;
    }
    return "—";
}

export function VerwaltungAufgabenPage() {
    const toast = useToastStore((s) => s.add);
    const [rows, setRows] = useState<PraxisAufgabe[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterTyp, setFilterTyp] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<TaskForm>(emptyForm);

    const load = useCallback(async () => {
        setErr(null);
        try {
            const [tasks, pats, team] = await Promise.all([
                listPraxisAufgabenAdmin(),
                listPatienten(),
                listPersonal(),
            ]);
            setRows(tasks);
            setPatients(pats);
            setPersonal(team.filter((m) => m.verfuegbar !== false));
        } catch (e) {
            setErr(errorMessage(e));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (filterStatus && r.status !== filterStatus) return false;
            if (filterTyp && r.typ !== filterTyp) return false;
            if (!q) return true;
            const pat = patientMap.get(r.patient_id);
            const hay = [
                r.titel,
                r.body ?? "",
                r.typ,
                r.status,
                pat?.name ?? "",
            ]
                .join(" ")
                .toLowerCase();
            return hay.includes(q);
        });
    }, [rows, search, filterStatus, filterTyp, patientMap]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { "": rows.length };
        for (const s of STATUSES) {
            counts[s.value] = rows.filter((r) => r.status === s.value).length;
        }
        return counts;
    }, [rows]);

    const openCreate = () => {
        setEditId(null);
        setForm(emptyForm());
        setShowCreate(true);
    };

    const openEdit = (row: PraxisAufgabe) => {
        setShowCreate(false);
        setEditId(row.id);
        setForm({
            patientId: row.patient_id,
            typ: row.typ,
            titel: row.titel,
            body: row.body ?? "",
            assigneeMode: row.assignee_role === "REZEPTION" ? "rezeption" : "user",
            assigneeUserId: row.assignee_user_id ?? "",
            status: row.status,
        });
    };

    const closeForm = () => {
        setShowCreate(false);
        setEditId(null);
        setForm(emptyForm());
    };

    const saveCreate = async () => {
        if (!form.patientId.trim()) {
            toast("Bitte Patient wählen.", "error");
            return;
        }
        if (!form.titel.trim()) {
            toast("Titel ist Pflicht.", "error");
            return;
        }
        setBusy(true);
        try {
            const created = await createPraxisAufgabeAdmin({
                patientId: form.patientId,
                typ: form.typ,
                titel: form.titel.trim(),
                body: form.body.trim() || null,
                assigneeRole: form.assigneeMode === "rezeption" ? "REZEPTION" : null,
                assigneeUserId: form.assigneeMode === "user" ? form.assigneeUserId || null : null,
            });
            setRows((prev) => [created, ...prev]);
            closeForm();
            toast("Aufgabe angelegt.", "success");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const saveEdit = async () => {
        if (!editId || !form.titel.trim()) {
            toast("Titel ist Pflicht.", "error");
            return;
        }
        setBusy(true);
        try {
            const updated = await updatePraxisAufgabeAdmin({
                id: editId,
                titel: form.titel.trim(),
                body: form.body.trim() || null,
                typ: form.typ,
                status: form.status,
                assigneeRole: form.assigneeMode === "rezeption" ? "REZEPTION" : null,
                assigneeUserId: form.assigneeMode === "user" ? form.assigneeUserId || null : null,
            });
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            closeForm();
            toast("Aufgabe gespeichert.", "success");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const handleQuickStatus = async (row: PraxisAufgabe, status: PraxisAufgabeStatus) => {
        if (row.status === status || busy) return;
        setBusy(true);
        try {
            const updated = await updatePraxisAufgabeAdmin({ id: row.id, status });
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            toast("Status aktualisiert.", "success");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const formPanel = (mode: "create" | "edit") => (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 className="text-title" style={{ margin: 0 }}>
                    {mode === "create" ? "Neue Aufgabe" : "Aufgabe bearbeiten"}
                </h3>
                <Button type="button" variant="ghost" size="sm" onClick={closeForm}>
                    Schließen
                </Button>
            </div>
            <div className="col" style={{ gap: 12, maxWidth: 720 }}>
                {mode === "create" ? (
                    <Select
                        id="aufgabe-patient"
                        label="Patient"
                        value={form.patientId}
                        onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                        options={[
                            { value: "", label: "Patient wählen…" },
                            ...patients.map((p) => ({
                                value: p.id,
                                label: p.name,
                            })),
                        ]}
                    />
                ) : null}
                <Input
                    id="aufgabe-titel"
                    label="Titel"
                    value={form.titel}
                    onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
                />
                <Textarea
                    id="aufgabe-body"
                    label="Beschreibung"
                    rows={3}
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                />
                <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                    <Select
                        id="aufgabe-typ"
                        label="Typ"
                        value={form.typ}
                        onChange={(e) => setForm((f) => ({ ...f, typ: e.target.value as PraxisAufgabeTyp }))}
                        options={TYPS.map((t) => ({ value: t.value, label: t.label }))}
                    />
                    {mode === "edit" ? (
                        <Select
                            id="aufgabe-status"
                            label="Status"
                            value={form.status}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, status: e.target.value as PraxisAufgabeStatus }))
                            }
                            options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                        />
                    ) : null}
                </div>
                <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <Select
                        id="aufgabe-assignee-mode"
                        label="Zugewiesen an"
                        value={form.assigneeMode}
                        onChange={(e) =>
                            setForm((f) => ({
                                ...f,
                                assigneeMode: e.target.value as AssigneeMode,
                            }))
                        }
                        options={[
                            { value: "rezeption", label: "Rezeption (Pool)" },
                            { value: "user", label: "Bestimmte Person" },
                        ]}
                    />
                    {form.assigneeMode === "user" ? (
                        <Select
                            id="aufgabe-assignee-user"
                            label="Person"
                            value={form.assigneeUserId}
                            onChange={(e) => setForm((f) => ({ ...f, assigneeUserId: e.target.value }))}
                            options={[
                                { value: "", label: "Person wählen…" },
                                ...personal.map((m) => ({
                                    value: m.id,
                                    label: `${m.name} (${m.rolle})`,
                                })),
                            ]}
                        />
                    ) : null}
                </div>
                <div className="row" style={{ gap: 8 }}>
                    <Button
                        type="button"
                        variant="primary"
                        disabled={busy}
                        onClick={() => void (mode === "create" ? saveCreate() : saveEdit())}
                    >
                        {mode === "create" ? "Anlegen" : "Speichern"}
                    </Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={closeForm}>
                        Abbrechen
                    </Button>
                </div>
            </div>
        </div>
    );

    if (loading) return <PageLoading label="Aufgaben werden geladen…" />;
    if (err) return <PageLoadError message={err} onRetry={() => void load()} />;

    return (
        <div className="page page-verwaltung-aufgaben">
            <div className="page-head row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <div className="text-caption" style={{ marginBottom: 4 }}>
                        <Link to="/verwaltung">Verwaltung</Link>
                        {" / Aufgaben"}
                    </div>
                    <h1 className="page-title">Praxis-Aufgaben</h1>
                    <p className="page-sub" style={{ margin: 0 }}>
                        Aufgaben anlegen, zuweisen und den Status verfolgen — zentral für die Praxisleitung.
                    </p>
                </div>
                {!showCreate && !editId ? (
                    <Button type="button" variant="primary" onClick={openCreate}>
                        <PlusIcon size={16} />
                        Neue Aufgabe
                    </Button>
                ) : null}
            </div>

            <div
                className="row termin-toolbar"
                style={{ gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}
            >
                <div className="row" style={{ gap: 8, flex: "1 1 200px", minWidth: 180, alignItems: "center" }}>
                    <SearchIcon size={16} aria-hidden />
                    <Input
                        id="aufgaben-search"
                        placeholder="Suchen (Titel, Patient…)"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Aufgaben durchsuchen"
                    />
                </div>
                <Select
                    id="aufgaben-filter-status"
                    aria-label="Status filtern"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    options={[{ value: "", label: "Alle Stati" }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
                />
                <Select
                    id="aufgaben-filter-typ"
                    aria-label="Typ filtern"
                    value={filterTyp}
                    onChange={(e) => setFilterTyp(e.target.value)}
                    options={[{ value: "", label: "Alle Typen" }, ...TYPS.map((t) => ({ value: t.value, label: t.label }))]}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => void load()} title="Aktualisieren">
                    <FilterIcon size={16} />
                    Aktualisieren
                </Button>
            </div>

            <div className="akte-zahl-modus" role="tablist" aria-label="Status filtern" style={{ marginBottom: 16, flexWrap: "wrap" }}>
                <button
                    type="button"
                    role="tab"
                    aria-selected={filterStatus === ""}
                    className={`akte-zahl-modus__btn${filterStatus === "" ? " is-active" : ""}`}
                    onClick={() => setFilterStatus("")}
                >
                    Alle ({statusCounts[""] ?? 0})
                </button>
                {STATUSES.map((s) => (
                    <button
                        key={s.value}
                        type="button"
                        role="tab"
                        aria-selected={filterStatus === s.value}
                        className={`akte-zahl-modus__btn${filterStatus === s.value ? " is-active" : ""}`}
                        onClick={() => setFilterStatus(s.value)}
                    >
                        {s.label} ({statusCounts[s.value] ?? 0})
                    </button>
                ))}
            </div>

            {showCreate ? formPanel("create") : null}

            {filtered.length === 0 ? (
                <EmptyState
                    title="Keine Aufgaben"
                    description={
                        rows.length === 0
                            ? "Legen Sie die erste Aufgabe an."
                            : "Keine Treffer für die aktuelle Filterung."
                    }
                />
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table className="tbl" style={{ width: "100%" }}>
                        <thead>
                            <tr>
                                <th>Aktualisiert</th>
                                <th>Titel</th>
                                <th>Patient</th>
                                <th>Typ</th>
                                <th>Zugewiesen</th>
                                <th>Status</th>
                                <th style={{ width: 120 }}>Aktion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((row) => {
                                const pat = patientMap.get(row.patient_id);
                                const patLabel = pat?.name ?? "—";
                                return (
                                    <Fragment key={row.id}>
                                        {editId === row.id ? (
                                            <tr>
                                                <td colSpan={7} style={{ padding: 0, border: "none" }}>
                                                    {formPanel("edit")}
                                                </td>
                                            </tr>
                                        ) : null}
                                        <tr>
                                            <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.updated_at)}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{row.titel}</div>
                                                {row.body ? (
                                                    <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{row.body}</div>
                                                ) : null}
                                            </td>
                                            <td>
                                                <Link to={`/patienten/${row.patient_id}`}>{patLabel}</Link>
                                            </td>
                                            <td>{row.typ}</td>
                                            <td>{assigneeLabel(row, personal)}</td>
                                            <td>
                                                <Select
                                                    id={`aufgabe-status-${row.id}`}
                                                    className="min-w-0"
                                                    aria-label={`Status: ${row.titel}`}
                                                    value={row.status}
                                                    disabled={busy || editId === row.id}
                                                    onChange={(e) =>
                                                        void handleQuickStatus(row, e.target.value as PraxisAufgabeStatus)
                                                    }
                                                    options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                                                />
                                            </td>
                                            <td>
                                                <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(row)}>
                                                    Bearbeiten
                                                </Button>
                                            </td>
                                        </tr>
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
