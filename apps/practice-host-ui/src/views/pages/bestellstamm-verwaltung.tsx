import { useCallback, useEffect, useMemo, useState } from "react";
import { listProdukte, createProdukt } from "@/systems/practice-host/controllers/produkt.controller";
import {
    listLieferantStamm,
    createLieferantStamm,
    deleteLieferantStamm,
    listPharmaberaterStamm,
    createPharmaberaterStamm,
    deletePharmaberaterStamm,
    listLieferantPharmaVorlagen,
    createLieferantPharmaVorlage,
    deleteLieferantPharmaVorlage,
} from "@/systems/practice-host/controllers/praxis.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { LieferantPharmaVorlage, LieferantStamm, PharmaberaterStamm, Produkt } from "@/models/types";
import { countProdukteWithName, errorMessage, produktSelectLabel } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { TrashIcon } from "@/lib/icons";
import { ProduktFormFields } from "../components/produkt-form-shared";
import { emptyForm, formValid, parseForm, type ProduktForm } from "@/lib/produkt-form-model";

/**
 * Verwaltung: Stammdaten für Bestellungen — Lieferanten, Pharmaberater/Kontakte
 * und gespeicherte Kombinationen für „Neue Bestellung“.
 */
export function BestellstammVerwaltungPage() {
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canWrite = role ? allowed("bestellung.write", role) : false;
    const canProduktWrite = role ? allowed("produkt.write", role) : false;

    const [lieferanten, setLieferanten] = useState<LieferantStamm[]>([]);
    const [kontakte, setKontakte] = useState<PharmaberaterStamm[]>([]);
    const [produkte, setProdukte] = useState<Produkt[]>([]);
    const [vorlagen, setVorlagen] = useState<LieferantPharmaVorlage[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);

    const [newLief, setNewLief] = useState("");
    const [newKontakt, setNewKontakt] = useState("");
    const [comboLiefId, setComboLiefId] = useState("");
    const [comboKontaktId, setComboKontaktId] = useState("");
    const [comboProduktId, setComboProduktId] = useState("");

    const [creatingProdukt, setCreatingProdukt] = useState(false);
    const [produktCreateForm, setProduktCreateForm] = useState<ProduktForm>(emptyForm());
    const [produktCreateBusy, setProduktCreateBusy] = useState(false);
    const [busy, setBusy] = useState(false);
    const [deleteKind, setDeleteKind] = useState<"lief" | "kontakt" | "vorlage" | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const reload = useCallback(async (opts?: { selectProduktId?: string }) => {
        setLoadError(null);
        setStatus("loading");
        try {
            const [l, k, v, prods] = await Promise.all([
                listLieferantStamm(),
                listPharmaberaterStamm(),
                listLieferantPharmaVorlagen(),
                listProdukte(),
            ]);
            setLieferanten(l);
            setKontakte(k);
            setProdukte(prods);
            setVorlagen(v);
            setComboLiefId((prev) => (prev && l.some((x) => x.id === prev) ? prev : l[0]?.id ?? ""));
            setComboKontaktId((prev) => (prev && k.some((x) => x.id === prev) ? prev : k[0]?.id ?? ""));
            setComboProduktId((prev) => {
                const prefer = opts?.selectProduktId;
                if (prefer && prods.some((x) => x.id === prefer)) return prefer;
                if (prev && prods.some((x) => x.id === prev)) return prev;
                return prods[0]?.id ?? "";
            });
            setStatus("ready");
        } catch (e) {
            setLoadError(errorMessage(e));
            setStatus("error");
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const liefOptions = useMemo(
        () => lieferanten.map((x) => ({ value: x.id, label: x.name })),
        [lieferanten],
    );
    const kontaktOptions = useMemo(
        () => kontakte.map((x) => ({ value: x.id, label: x.name })),
        [kontakte],
    );

    const produkteSorted = useMemo(
        () => [...produkte].sort((a, b) => a.name.localeCompare(b.name, "de")),
        [produkte],
    );
    const produktOptions = useMemo(
        () =>
            produkteSorted.map((p) => ({
                value: p.id,
                label: produktSelectLabel(p, countProdukteWithName(produkte, p.name)),
            })),
        [produkte, produkteSorted],
    );

    const kategorieVorschlaege = useMemo(() => {
        const s = new Set<string>();
        for (const p of produkte) {
            const k = p.kategorie?.trim();
            if (k) s.add(k);
        }
        return [...s].sort((a, b) => a.localeCompare(b, "de"));
    }, [produkte]);

    const addLieferant = async () => {
        if (!canWrite || !newLief.trim()) {
            toast("Name eingeben.", "error");
            return;
        }
        setBusy(true);
        try {
            await createLieferantStamm({ name: newLief.trim() });
            toast("Lieferant gespeichert");
            setNewLief("");
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const addKontakt = async () => {
        if (!canWrite || !newKontakt.trim()) {
            toast("Name eingeben.", "error");
            return;
        }
        setBusy(true);
        try {
            await createPharmaberaterStamm({ name: newKontakt.trim() });
            toast("Kontakt gespeichert");
            setNewKontakt("");
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const cancelCreateProdukt = () => {
        setCreatingProdukt(false);
        setProduktCreateForm(emptyForm());
    };

    const handleCreateProdukt = async () => {
        if (!formValid(produktCreateForm) || !canProduktWrite) return;
        setProduktCreateBusy(true);
        try {
            const payload = parseForm(produktCreateForm);
            const created = await createProdukt(payload);
            toast("Produkt erstellt", "success");
            setProduktCreateForm(emptyForm());
            setCreatingProdukt(false);
            await reload({ selectProduktId: created.id });
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setProduktCreateBusy(false);
        }
    };

    const addVorlage = async () => {
        if (!canWrite || !comboLiefId || !comboKontaktId || !comboProduktId) {
            toast("Lieferant, Kontakt und Produkt wählen.", "error");
            return;
        }
        setBusy(true);
        try {
            await createLieferantPharmaVorlage({
                lieferant_id: comboLiefId,
                pharmaberater_id: comboKontaktId,
                produkt_id: comboProduktId,
            });
            toast("Kombination gespeichert");
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteId || !deleteKind || !canWrite) return;
        setBusy(true);
        try {
            if (deleteKind === "lief") await deleteLieferantStamm(deleteId);
            else if (deleteKind === "kontakt") await deletePharmaberaterStamm(deleteId);
            else await deleteLieferantPharmaVorlage(deleteId);
            toast("Eintrag entfernt");
            setDeleteId(null);
            setDeleteKind(null);
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    if (status === "loading") return <PageLoading label="Stammdaten werden geladen…" />;
    if (status === "error" && loadError) {
        return (
            <div className="praxis-workspace-page animate-fade-in--sticky-safe">
                <VerwaltungPageHeader title="Bestell-Stammdaten" />
                <PageLoadError message={loadError} onRetry={() => void reload()} />
            </div>
        );
    }

    return (
        <div className="praxis-workspace-page animate-fade-in--sticky-safe">
            <VerwaltungPageHeader
                titleLevel="h1"
                title="Bestell-Stammdaten"
                subtitle={
                    <>
                        Lieferanten und Pharmaberater/Kontakte vordefinieren; Kombinationen erscheinen als Schnellwahl in <b>Neue Bestellung</b>. Freie Eingabe bleibt möglich.
                    </>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card card-pad">
                    <h2 className="text-title" style={{ margin: "0 0 12px" }}>Lieferanten</h2>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                            <Input
                                id="bs-lief-new"
                                label="Neuer Lieferant"
                                value={newLief}
                                onChange={(e) => setNewLief(e.target.value)}
                                disabled={!canWrite}
                                placeholder="z. B. Dental-Depot"
                            />
                        </div>
                        <Button type="button" style={{ alignSelf: "flex-end" }} onClick={() => void addLieferant()} disabled={!canWrite || busy}>
                            Hinzufügen
                        </Button>
                    </div>
                    {lieferanten.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", fontSize: 13 }}>Noch keine Einträge.</p>
                    ) : (
                        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--fg-2)" }}>
                            {lieferanten.map((r) => (
                                <li key={r.id} style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span>{r.name}</span>
                                    {canWrite ? (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => { setDeleteKind("lief"); setDeleteId(r.id); }} aria-label="Entfernen">
                                            <TrashIcon size={14} />
                                        </Button>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="card card-pad">
                    <h2 className="text-title" style={{ margin: "0 0 12px" }}>Pharmaberater / Kontakt</h2>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                            <Input
                                id="bs-kontakt-new"
                                label="Neuer Kontakt"
                                value={newKontakt}
                                onChange={(e) => setNewKontakt(e.target.value)}
                                disabled={!canWrite}
                                placeholder="Name der Ansprechperson"
                            />
                        </div>
                        <Button type="button" style={{ alignSelf: "flex-end" }} onClick={() => void addKontakt()} disabled={!canWrite || busy}>
                            Hinzufügen
                        </Button>
                    </div>
                    {kontakte.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", fontSize: 13 }}>Noch keine Einträge.</p>
                    ) : (
                        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--fg-2)" }}>
                            {kontakte.map((r) => (
                                <li key={r.id} style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span>{r.name}</span>
                                    {canWrite ? (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => { setDeleteKind("kontakt"); setDeleteId(r.id); }} aria-label="Entfernen">
                                            <TrashIcon size={14} />
                                        </Button>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {canProduktWrite ? (
                <Card>
                    <CardHeader
                        title="Neues Produkt (Lager)"
                        subtitle="Wie unter Produkte — erscheint direkt in der Auswahl „Produkt (Lager)“ für Kombinationen."
                        action={
                            <Button
                                type="button"
                                size="sm"
                                variant={creatingProdukt ? "secondary" : "ghost"}
                                onClick={
                                    creatingProdukt
                                        ? cancelCreateProdukt
                                        : () => {
                                              setCreatingProdukt(true);
                                              setProduktCreateForm(emptyForm());
                                          }
                                }
                            >
                                {creatingProdukt ? "Abbrechen" : "+ Neues Produkt"}
                            </Button>
                        }
                    />
                    {creatingProdukt ? (
                        <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                            <ProduktFormFields
                                form={produktCreateForm}
                                setForm={setProduktCreateForm}
                                idPrefix="bs-prod-new"
                                kategorieVorschlaege={kategorieVorschlaege}
                            />
                            <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                                <Button type="button" variant="ghost" onClick={cancelCreateProdukt} disabled={produktCreateBusy}>
                                    Abbrechen
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void handleCreateProdukt()}
                                    disabled={!formValid(produktCreateForm) || produktCreateBusy}
                                    loading={produktCreateBusy}
                                >
                                    Erstellen
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </Card>
            ) : null}

            <div className="card card-pad">
                <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 0 }}>
                    Verknüpft einen Lieferanten mit einem Kontakt — in <b>Neue Bestellung</b> als Dropdown „Vorlage“ wählbar.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignItems: "flex-end" }}>
                    <Select
                        id="bs-combo-l"
                        label="Lieferant"
                        value={comboLiefId}
                        onChange={(e) => setComboLiefId(e.target.value)}
                        options={[{ value: "", label: "— wählen —" }, ...liefOptions]}
                        disabled={!canWrite || liefOptions.length === 0}
                    />
                    <Select
                        id="bs-combo-p"
                        label="Pharmaberater / Kontakt"
                        value={comboKontaktId}
                        onChange={(e) => setComboKontaktId(e.target.value)}
                        options={[{ value: "", label: "— wählen —" }, ...kontaktOptions]}
                        disabled={!canWrite || kontaktOptions.length === 0}
                    />
                </div>
                <div style={{ marginTop: 12, maxWidth: 560 }}>
                    <Select
                        id="bs-combo-prod"
                        label="Produkt (Lager)"
                        value={comboProduktId}
                        onChange={(e) => setComboProduktId(e.target.value)}
                        options={[{ value: "", label: "— wählen —" }, ...produktOptions]}
                        disabled={!canWrite || produktOptions.length === 0}
                    />
                </div>
                <div className="row" style={{ gap: 10, marginTop: 12 }}>
                    <Button
                        type="button"
                        onClick={() => void addVorlage()}
                        disabled={!canWrite || busy || !comboLiefId || !comboKontaktId || !comboProduktId}
                    >
                        Kombination speichern
                    </Button>
                </div>

                {vorlagen.length > 0 ? (
                    <div style={{ overflowX: "auto", marginTop: 16 }} className="tbl-scroll">
                        <table className="tbl tbl-fluid">
                            <thead>
                                <tr>
                                    <th>Lieferant</th>
                                    <th>Kontakt</th>
                                    <th>Produkt</th>
                                    <th style={{ width: 100 }}>Aktion</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vorlagen.map((v) => (
                                    <tr key={v.id}>
                                        <td>{v.lieferant_name}</td>
                                        <td>{v.pharmaberater_name}</td>
                                        <td>
                                            {v.produkt_aktiv === 0 ? (
                                                <span style={{ color: "var(--fg-3)" }} title="Produkt im Lager inaktiv">
                                                    {v.produkt_name} (Lager: inaktiv)
                                                </span>
                                            ) : (
                                                <span>
                                                    {v.produkt_name} · {v.produkt_kategorie}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {canWrite ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => { setDeleteKind("vorlage"); setDeleteId(v.id); }}
                                                >
                                                    <TrashIcon size={14} /> Entfernen
                                                </Button>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p style={{ color: "var(--fg-3)", fontSize: 13, marginBottom: 0 }}>Noch keine Kombinationen.</p>
                )}
            </div>

            {!canWrite ? (
                <p style={{ fontSize: 13, color: "var(--fg-3)" }}>Bearbeiten mit Rolle inkl. Bestellberechtigung (z. B. Arzt, Rezeption, Pharmaberater).</p>
            ) : null}

            <ConfirmDialog
                open={!!deleteId && !!deleteKind}
                onClose={() => {
                    if (busy) return;
                    setDeleteId(null);
                    setDeleteKind(null);
                }}
                onConfirm={() => void confirmDelete()}
                title="Eintrag entfernen"
                message="Der Eintrag wird für Formulare ausgeblendet (deaktiviert)."
                confirmLabel="Entfernen"
                danger
                loading={busy}
            />
        </div>
    );
}
