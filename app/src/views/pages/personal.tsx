import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createPersonal, deletePersonal, listPersonal, setPersonalPasswordByAdmin, updatePersonal } from "../../controllers/personal.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { errorMessage, formatDate } from "../../lib/utils";
import type { Personal } from "../../models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import { EditIcon } from "@/lib/icons";
import type { Rolle } from "@/models/types";

function initialsFromName(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("");
}

const ROLLE_OPTIONS = [
    { value: "ARZT", label: "Arzt" },
    { value: "REZEPTION", label: "Rezeption" },
    { value: "STEUERBERATER", label: "Steuerberater" },
    { value: "PHARMABERATER", label: "Pharmaberater" },
] as const;

export function PersonalPage() {
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
    const [createErrors, setCreateErrors] = useState<{ name?: string; email?: string; passwort?: string }>({});
    const [createBusy, setCreateBusy] = useState(false);
    const [selected, setSelected] = useState<Personal | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        email: "",
        rolle: "REZEPTION" as Rolle,
        taetigkeitsbereich: "",
        fachrichtung: "",
        telefon: "",
        verfuegbar: true,
    });
    const [editBusy, setEditBusy] = useState(false);
    const [resetPw, setResetPw] = useState("");
    const [resetPw2, setResetPw2] = useState("");
    const [resetPwError, setResetPwError] = useState<string | undefined>(undefined);
    const [resetBusy, setResetBusy] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canWrite = role != null && allowed("personal.write", role);

    const load = useCallback(
        async (opts?: { initial?: boolean }) => {
            const isInitial = opts?.initial === true;
            if (isInitial) {
                setLoading(true);
                setLoadError(null);
            }
            try {
                const p = await listPersonal();
                setPersonal(p);
                setSelected((cur) => {
                    if (!cur) return null;
                    return p.find((x) => x.id === cur.id) ?? null;
                });
            } catch (e) {
                const msg = errorMessage(e);
                if (isInitial) setLoadError(msg);
                else toast(`Aktualisieren fehlgeschlagen: ${msg}`);
            } finally {
                if (isInitial) setLoading(false);
            }
        },
        [toast],
    );

    useEffect(() => {
        void load({ initial: true });
    }, [load]);

    const neuFromQuery = searchParams.get("neu");
    useEffect(() => {
        if (neuFromQuery !== "1" || !canWrite) return;
        setCreating(true);
        setSelected(null);
        setCreateForm({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
        setCreateErrors({});
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("neu");
                return n;
            },
            { replace: true },
        );
    }, [neuFromQuery, canWrite, setSearchParams]);

    const toEditForm = (p: Personal) => ({
        name: p.name,
        email: p.email,
        rolle: p.rolle,
        taetigkeitsbereich: p.taetigkeitsbereich ?? "",
        fachrichtung: p.fachrichtung ?? "",
        telefon: p.telefon ?? "",
        verfuegbar: p.verfuegbar,
    });

    const openCreate = () => {
        setCreating(true);
        setDetailEdit(false);
        setSelected(null);
        setCreateForm({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
        setCreateErrors({});
    };

    const cancelCreate = () => {
        setCreating(false);
        setCreateForm({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
    };

    const selectRow = (p: Personal) => {
        setCreating(false);
        setDetailEdit(false);
        setSelected(p);
    };

    const startEdit = () => {
        if (!selected) return;
        setDetailEdit(true);
        setEditForm(toEditForm(selected));
        setResetPw("");
        setResetPw2("");
        setResetPwError(undefined);
    };

    const cancelEdit = () => {
        setDetailEdit(false);
        if (selected) setEditForm(toEditForm(selected));
        setResetPw("");
        setResetPw2("");
        setResetPwError(undefined);
    };

    const handlePasswordReset = async () => {
        if (!selected || !canWrite) return;
        setResetPwError(undefined);
        if (!resetPw) {
            setResetPwError("Bitte neues Passwort eingeben.");
            return;
        }
        if (resetPw.length < 8) {
            setResetPwError("Mindestens 8 Zeichen erforderlich.");
            return;
        }
        if (resetPw !== resetPw2) {
            setResetPwError("Passwörter stimmen nicht überein.");
            return;
        }
        setResetBusy(true);
        try {
            await setPersonalPasswordByAdmin(selected.id, resetPw);
            toast("Passwort wurde neu gesetzt.", "success");
            setResetPw("");
            setResetPw2("");
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        } finally {
            setResetBusy(false);
        }
    };

    const handleUpdate = async () => {
        if (!selected || !canWrite) return;
        if (!editForm.name.trim() || !editForm.email.trim()) {
            toast("Name und E-Mail sind Pflichtfelder.", "error");
            return;
        }
        setEditBusy(true);
        try {
            const updated = await updatePersonal(selected.id, {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                rolle: editForm.rolle,
                taetigkeitsbereich: editForm.taetigkeitsbereich.trim() || null,
                fachrichtung: editForm.fachrichtung.trim() || null,
                telefon: editForm.telefon.trim() || null,
                verfuegbar: editForm.verfuegbar,
            });
            toast("Mitarbeiter gespeichert", "success");
            setDetailEdit(false);
            setSelected(updated);
            void load();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        } finally {
            setEditBusy(false);
        }
    };

    const validateCreate = (): boolean => {
        const next: typeof createErrors = {};
        if (!createForm.name.trim()) next.name = "Bitte Namen eingeben";
        if (!createForm.email.trim()) {
            next.email = "Bitte E-Mail eingeben";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(createForm.email.trim())) {
            next.email = "Ungültige E-Mail-Adresse";
        }
        if (!createForm.passwort) {
            next.passwort = "Bitte Passwort eingeben";
        } else if (createForm.passwort.length < 8) {
            next.passwort = "Mindestens 8 Zeichen erforderlich";
        }
        setCreateErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleCreate = async () => {
        if (!canWrite || !validateCreate()) return;
        setCreateBusy(true);
        try {
            const created = await createPersonal({
                name: createForm.name.trim(),
                email: createForm.email.trim(),
                passwort: createForm.passwort,
                rolle: createForm.rolle,
            });
            toast("Mitarbeiter erstellt", "success");
            setCreating(false);
            setCreateForm({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
            setSelected(created);
            void load();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        } finally {
            setCreateBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId || !canWrite) return;
        setDeleteBusy(true);
        try {
            await deletePersonal(deleteId);
            toast("Eintrag entfernt", "success");
            setDetailEdit(false);
            setSelected((s) => (s?.id === deleteId ? null : s));
            setDeleteId(null);
            void load();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        } finally {
            setDeleteBusy(false);
        }
    };

    const sorted = useMemo(
        () => [...personal].sort((a, b) => a.name.localeCompare(b.name, "de")),
        [personal],
    );

    const readField = (label: string, value: string | null | boolean | undefined) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
                style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--fg-4)",
                }}
            >
                {label}
            </span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>
                {value === null || value === undefined || value === "" ? "—" : String(value)}
            </span>
        </div>
    );

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title="Neuer Mitarbeiter"
                        subtitle="Stammdaten und Zugang — erscheint hier rechts, nicht auf separater Seite."
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                Schließen
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <Input
                            id="pers-new-name"
                            label="Name *"
                            value={createForm.name}
                            error={createErrors.name}
                            onChange={(e) => {
                                setCreateForm((f) => ({ ...f, name: e.target.value }));
                                if (createErrors.name) setCreateErrors((x) => ({ ...x, name: undefined }));
                            }}
                        />
                        <Input
                            id="pers-new-email"
                            type="email"
                            label="E-Mail *"
                            value={createForm.email}
                            error={createErrors.email}
                            onChange={(e) => {
                                setCreateForm((f) => ({ ...f, email: e.target.value }));
                                if (createErrors.email) setCreateErrors((x) => ({ ...x, email: undefined }));
                            }}
                        />
                        <Input
                            id="pers-new-pw"
                            type="password"
                            label="Passwort * (min. 8 Zeichen)"
                            value={createForm.passwort}
                            error={createErrors.passwort}
                            onChange={(e) => {
                                setCreateForm((f) => ({ ...f, passwort: e.target.value }));
                                if (createErrors.passwort) setCreateErrors((x) => ({ ...x, passwort: undefined }));
                            }}
                        />
                        <Select
                            id="pers-new-rolle"
                            label="Rolle"
                            value={createForm.rolle}
                            onChange={(e) => setCreateForm((f) => ({ ...f, rolle: e.target.value }))}
                            options={ROLLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                        />
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelCreate} disabled={createBusy}>
                                Abbrechen
                            </Button>
                            <Button type="button" onClick={() => void handleCreate()} loading={createBusy} disabled={createBusy}>
                                Erstellen
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected && detailEdit && canWrite) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title="Mitarbeiter bearbeiten"
                        subtitle="Stammdaten, Einsatzstatus und ggf. neues Passwort setzen (ohne altes Passwort)."
                        action={
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={editBusy || resetBusy}>
                                Abbrechen
                            </Button>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <Input
                            id="pers-ed-name"
                            label="Name *"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                        <Input
                            id="pers-ed-email"
                            type="email"
                            label="E-Mail *"
                            value={editForm.email}
                            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        />
                        <Select
                            id="pers-ed-rolle"
                            label="Rolle"
                            value={editForm.rolle}
                            onChange={(e) => setEditForm((f) => ({ ...f, rolle: e.target.value as Rolle }))}
                            options={ROLLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                        />
                        <Input
                            id="pers-ed-taet"
                            label="Tätigkeitsbereich"
                            value={editForm.taetigkeitsbereich}
                            onChange={(e) => setEditForm((f) => ({ ...f, taetigkeitsbereich: e.target.value }))}
                        />
                        <Input
                            id="pers-ed-fach"
                            label="Fachrichtung"
                            value={editForm.fachrichtung}
                            onChange={(e) => setEditForm((f) => ({ ...f, fachrichtung: e.target.value }))}
                        />
                        <Input
                            id="pers-ed-tel"
                            label="Telefon"
                            value={editForm.telefon}
                            onChange={(e) => setEditForm((f) => ({ ...f, telefon: e.target.value }))}
                        />
                        <Select
                            id="pers-ed-status"
                            label="Einsatzstatus (Verfügbarkeit)"
                            value={editForm.verfuegbar ? "1" : "0"}
                            onChange={(e) => setEditForm((f) => ({ ...f, verfuegbar: e.target.value === "1" }))}
                            options={[
                                { value: "1", label: "Verfügbar" },
                                { value: "0", label: "Nicht verfügbar" },
                            ]}
                        />
                        <div
                            className="card card-pad"
                            style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-1)", borderColor: "var(--border-2)" }}
                        >
                            <p className="text-title" style={{ margin: 0, fontSize: 14 }}>Passwort zurücksetzen</p>
                            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                                Neues Passwort für diesen Zugang setzen. Das alte Passwort ist nicht nötig (nur in der Personalverwaltung sichtbar).
                            </p>
                            <Input
                                id="pers-ed-pw1"
                                type="password"
                                autoComplete="new-password"
                                label="Neues Passwort (min. 8 Zeichen)"
                                value={resetPw}
                                error={resetPwError}
                                onChange={(e) => {
                                    setResetPw(e.target.value);
                                    if (resetPwError) setResetPwError(undefined);
                                }}
                            />
                            <Input
                                id="pers-ed-pw2"
                                type="password"
                                autoComplete="new-password"
                                label="Passwort bestätigen"
                                value={resetPw2}
                                onChange={(e) => {
                                    setResetPw2(e.target.value);
                                    if (resetPwError) setResetPwError(undefined);
                                }}
                            />
                            <div className="row" style={{ justifyContent: "flex-end" }}>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => void handlePasswordReset()}
                                    disabled={resetBusy}
                                    loading={resetBusy}
                                >
                                    Passwort setzen
                                </Button>
                            </div>
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={editBusy}>
                                Abbrechen
                            </Button>
                            <Button type="button" onClick={() => void handleUpdate()} loading={editBusy} disabled={editBusy || resetBusy}>
                                Stammdaten speichern
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected) {
            const p = selected;
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={p.name}
                        subtitle="Mitarbeiter · In „Bearbeiten“: Einsatzstatus und Passwort zurücksetzen."
                        action={
                            canWrite ? (
                                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                    <Button type="button" size="sm" variant="secondary" onClick={startEdit}>
                                        <EditIcon size={14} /> Bearbeiten
                                    </Button>
                                    <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(p.id)}>
                                        Entfernen
                                    </Button>
                                </div>
                            ) : null
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="produkte-read-grid">
                            {readField("E-Mail", p.email)}
                            {readField("Rolle", p.rolle)}
                            {readField("Tätigkeitsbereich", p.taetigkeitsbereich ?? "—")}
                            {readField("Fachrichtung", p.fachrichtung ?? "—")}
                            {readField("Telefon", p.telefon ?? "—")}
                            {readField("Verfügbar", p.verfuegbar ? "Ja" : "Nein")}
                            <div style={{ gridColumn: "1 / -1" }}>
                                {readField("Angelegt", formatDate(p.created_at))}
                            </div>
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {canWrite
                        ? "Wählen Sie eine Zeile für Details, oder „+ Neuer Mitarbeiter“ — die Erfassung erscheint hier."
                        : "Wählen Sie eine Zeile, um die Details zu sehen."}
                </p>
            </Card>
        );
    })();

    return (
        <div className="produkte-page animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
                <VerwaltungBackButton />
            </div>
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Personalverwaltung</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Team, Rollen und Zugang — Liste links, anlegen und Details rechts (wie Produkte).
                    </p>
                </div>
                {canWrite ? (
                    <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                        {creating ? "Abbrechen" : "+ Neuer Mitarbeiter"}
                    </Button>
                ) : null}
            </div>

            {loading ? (
                <PageLoading label="Personal wird geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : (
                <div className="produkte-workspace">
                    <div className="produkte-workspace__list">
                        {sorted.length === 0 ? (
                            <Card className="card-pad">
                                <EmptyState
                                    icon="👤"
                                    title="Kein Personal vorhanden"
                                    description={canWrite ? "Rechts erscheint die Maske, sobald Sie „+ Neuer Mitarbeiter“ wählen." : "Keine Einträge."}
                                />
                            </Card>
                        ) : (
                            <div className="card produkte-table-card" style={{ overflow: "auto" }}>
                                <table className="tbl produkte-tbl" style={{ minWidth: 480 }}>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ width: 48 }} />
                                            <th scope="col">Name</th>
                                            <th scope="col">Rolle</th>
                                            <th scope="col">E-Mail</th>
                                            <th scope="col" style={{ textAlign: "right" }}>Verfügbarkeit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.map((p) => {
                                            const isSel = !creating && selected?.id === p.id;
                                            return (
                                                <tr
                                                    key={p.id}
                                                    className={isSel ? "produkte-row--selected" : undefined}
                                                    onClick={() => selectRow(p)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <td>
                                                        <span
                                                            className="av"
                                                            style={{ background: "linear-gradient(135deg,#9be7ff,#0A84FF)" }}
                                                        >
                                                            {initialsFromName(p.name)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{p.name}</span>
                                                    </td>
                                                    <td>
                                                        <span className="page-sub" style={{ fontSize: 13 }}>{p.rolle}</span>
                                                    </td>
                                                    <td>
                                                        <span className="page-sub" style={{ fontSize: 13, color: "var(--fg-3)" }}>{p.email}</span>
                                                    </td>
                                                    <td style={{ textAlign: "right" }}>
                                                        <Badge variant={p.verfuegbar ? "success" : "default"}>
                                                            {p.verfuegbar ? "Verfügbar" : "Nicht verfügbar"}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <div className="produkte-workspace__detail">{sidePanel}</div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => !deleteBusy && setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title="Mitarbeiter entfernen"
                message="Der Zugang wird deaktiviert. Fortfahren?"
                confirmLabel="Entfernen"
                danger
                loading={deleteBusy}
            />
        </div>
    );
}
