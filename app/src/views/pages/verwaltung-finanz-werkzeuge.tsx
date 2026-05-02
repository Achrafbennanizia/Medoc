import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAkte, listBehandlungen, listUntersuchungen } from "../../controllers/akte.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { allocateRechnungsnummer, renderInvoicePdf } from "../../controllers/invoice.controller";
import { listZahlungenForPatient } from "../../controllers/zahlung.controller";
import type { InvoiceInput } from "@/controllers/invoice.controller";
import {
    appendRechnungDocument,
    INVOICE_HISTORY_MAX,
    listRechnungDocuments,
    migrateLegacyInvoiceHistoryFromLocalStorageOnce,
    sumInvoiceEur,
    type SavedInvoice,
} from "@/controllers/rechnung-document.controller";
import { getInvoicePraxisFromStorage, lineFromLeistungWahl } from "@/lib/invoice-leistung";
import { buildZahlLinkSelectOptions } from "@/lib/zahlung-buchung";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { openExportPreview } from "@/models/store/export-preview-store";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { Behandlung, Patient, Untersuchung, Zahlung } from "@/models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Textarea, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";

const todayYmd = () => new Date().toISOString().slice(0, 10);

type LineRow = { id: string; link: string };

const newRow = (): LineRow => ({ id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, link: "" });

/**
 * Rechnung (PDF) — FA-FIN-INVOICE: B-/U-Zeilen aus der Patientenakte, Nummer/Praxis/Datum/Brutto automatisch.
 */
export function VerwaltungFinanzWerkzeugePage() {
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canWriteZahlung = role != null && allowed("finanzen.write", role);
    const canReadFinanzen = role != null && allowed("finanzen.read", role);

    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [patientZahlungen, setPatientZahlungen] = useState<Zahlung[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [invBusy, setInvBusy] = useState(false);
    const [patientId, setPatientId] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(() => todayYmd());
    const [rechnungNr, setRechnungNr] = useState("");
    const [invoiceHistory, setInvoiceHistory] = useState<SavedInvoice[]>([]);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [praxis, setPraxis] = useState(getInvoicePraxisFromStorage);
    const [behandlungen, setBehandlungen] = useState<Behandlung[]>([]);
    const [untersuchungen, setUntersuchungen] = useState<Untersuchung[]>([]);
    const [aktenBusy, setAktenBusy] = useState(false);
    const [lines, setLines] = useState<LineRow[]>(() => [newRow()]);
    const [note, setNote] = useState("");
    const navigate = useNavigate();

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const pats = await listPatienten();
            setPatienten(pats);
            setPraxis(getInvoicePraxisFromStorage());
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        void (async () => {
            if (canWriteZahlung) {
                await migrateLegacyInvoiceHistoryFromLocalStorageOnce();
            }
            try {
                const h = await listRechnungDocuments(INVOICE_HISTORY_MAX);
                setInvoiceHistory(h);
                if (h.length > 0) {
                    setSelectedHistoryId((cur) => cur ?? h[0]!.id);
                }
            } catch (e) {
                toast(`Rechnungsverlauf: ${errorMessage(e)}`, "error");
                setInvoiceHistory([]);
            }
        })();
    }, [canWriteZahlung, toast]);

    useEffect(() => {
        if (!patientId) {
            setRechnungNr("");
            setBehandlungen([]);
            setUntersuchungen([]);
            setPatientZahlungen([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const h = await listRechnungDocuments(INVOICE_HISTORY_MAX);
                const reserved = new Set(h.map((x) => x.invoice.number.trim()));
                const n = await allocateRechnungsnummer(invoiceDate, { reserved });
                if (!cancelled) setRechnungNr(n);
            } catch {
                if (!cancelled) setRechnungNr("");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [patientId, invoiceDate]);

    useEffect(() => {
        if (!patientId) return;
        let cancel = false;
        setAktenBusy(true);
        (async () => {
            try {
                const akte = await getAkte(patientId);
                if (cancel) return;
                const [b, u, z] = await Promise.all([
                    listBehandlungen(akte.id),
                    listUntersuchungen(akte.id),
                    listZahlungenForPatient(patientId),
                ]);
                if (!cancel) {
                    setBehandlungen(b);
                    setUntersuchungen(u);
                    setPatientZahlungen(z);
                }
            } catch (e) {
                if (!cancel) {
                    setBehandlungen([]);
                    setUntersuchungen([]);
                    setPatientZahlungen([]);
                    toast(`Akte: ${errorMessage(e)}`, "error");
                }
            } finally {
                if (!cancel) setAktenBusy(false);
            }
        })();
        return () => {
            cancel = true;
        };
    }, [patientId, toast]);

    const selectedEntry = useMemo(
        () => invoiceHistory.find((x) => x.id === selectedHistoryId) ?? null,
        [invoiceHistory, selectedHistoryId],
    );

    const linkOptions = useMemo(() => buildZahlLinkSelectOptions(behandlungen, untersuchungen), [behandlungen, untersuchungen]);

    const linkOptionsPerRow = useCallback(
        (row: LineRow, allRows: LineRow[]) => {
            const other = new Set(
                allRows
                    .filter((x) => x.id !== row.id)
                    .map((x) => x.link)
                    .filter(Boolean),
            );
            return linkOptions.filter((o) => !o.value || o.value === row.link || !other.has(o.value));
        },
        [linkOptions],
    );

    const builtLines = useMemo(() => {
        if (!patientId) return [];
        return lines
            .map((row) => (row.link ? lineFromLeistungWahl(row.link, patientId, behandlungen, untersuchungen, patientZahlungen) : null))
            .filter((x): x is NonNullable<typeof x> => x != null);
    }, [patientId, lines, behandlungen, untersuchungen, patientZahlungen]);

    const betragBruttoEur = useMemo(
        () => (builtLines.length > 0 ? builtLines.reduce((s, l) => s + l.amount_cents, 0) / 100 : 0),
        [builtLines],
    );

    const handleInvoicePdf = async () => {
        const p = patienten.find((x) => x.id === patientId);
        if (!p) {
            toast("Bitte einen Patienten wählen.");
            return;
        }
        if (aktenBusy) {
            toast("Patientenakte wird noch geladen…");
            return;
        }
        const withLinks = lines.filter((x) => x.link);
        if (withLinks.length === 0) {
            toast("Bitte mindestens eine Leistung (B-/U-Zeile) wählen.");
            return;
        }
        const pdfLines = withLinks
            .map((row) => lineFromLeistungWahl(row.link, patientId, behandlungen, untersuchungen, patientZahlungen))
            .filter((x): x is NonNullable<typeof x> => x != null);
        if (pdfLines.length === 0) {
            toast("Leistungszeilen konnten nicht aufgebaut werden.");
            return;
        }
        const h = await listRechnungDocuments(INVOICE_HISTORY_MAX);
        const reservedNums = new Set(h.map((x) => x.invoice.number.trim()));
        const num =
            rechnungNr.trim()
            || (await allocateRechnungsnummer(invoiceDate, { reserved: reservedNums }));
        const payload: InvoiceInput = {
            number: num,
            date: invoiceDate,
            recipient_name: p.name,
            recipient_address: p.adresse
                ? p.adresse.split("\n").map((s) => s.trim()).filter(Boolean)
                : ["–"],
            practice_name: praxis.name.trim(),
            practice_address: praxis.addr.split("\n").map((s) => s.trim()).filter(Boolean),
            lines: pdfLines.map((l) => ({ description: l.description, amount_cents: l.amount_cents })),
            note: note.trim() || null,
        };
        setInvBusy(true);
        try {
            const bytes = await renderInvoicePdf(payload);
            openExportPreview({
                format: "pdf",
                title: "Rechnung (PDF)",
                hint: `Vorschau · Nummer ${num}, Datum ${invoiceDate}. Der Verlauf wird nach Erzeugung aktualisiert; PDF hier drucken oder speichern.`,
                suggestedFilename: `rechnung-${num.replace(/[^\w.-]+/g, "_")}.pdf`,
                binaryBody: new Uint8Array(bytes),
            });
            const newId =
                globalThis.crypto?.randomUUID != null
                    ? globalThis.crypto.randomUUID()
                    : `re-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            await appendRechnungDocument({
                id: newId,
                createdAt: new Date().toISOString(),
                patientId,
                invoice: payload,
            });
            setInvoiceHistory(await listRechnungDocuments(INVOICE_HISTORY_MAX));
            setSelectedHistoryId(newId);
            setCreating(false);
            toast("Rechnungs-PDF erzeugt und im Verlauf gespeichert.", "success");
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setInvBusy(false);
        }
    };

    const resetForm = () => {
        setPatientId("");
        setLines([newRow()]);
        setNote("");
        setInvoiceDate(todayYmd());
    };

    const openCreate = () => {
        setCreating(true);
        setSelectedHistoryId(null);
        resetForm();
    };

    const cancelCreate = () => {
        setCreating(false);
        void listRechnungDocuments(INVOICE_HISTORY_MAX).then((h) => {
            setSelectedHistoryId(h[0]?.id ?? null);
        });
    };

    const selectHistoryRow = (id: string) => {
        setSelectedHistoryId(id);
        setCreating(false);
    };

    const handleRedownloadInvoice = async (inv: InvoiceInput) => {
        setInvBusy(true);
        try {
            const bytes = await renderInvoicePdf(inv);
            openExportPreview({
                format: "pdf",
                title: "Rechnung erneut exportieren",
                hint: `PDF · Rechnung ${inv.number}`,
                suggestedFilename: `rechnung-${inv.number.replace(/[^\w.-]+/g, "_")}.pdf`,
                binaryBody: new Uint8Array(bytes),
            });
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setInvBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <h2 className="page-title">Rechnung (PDF)</h2>
                <PageLoading label="Daten werden geladen…" />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <h2 className="page-title">Rechnung (PDF)</h2>
                <PageLoadError message={loadError} onRetry={() => void load()} />
            </div>
        );
    }

    if (!canReadFinanzen) {
        return (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                    <VerwaltungBackButton />
                </div>
                <h1 className="page-title" style={{ margin: 0 }}>Rechnung (PDF)</h1>
                <p className="page-sub" style={{ margin: 0 }}>Keine Berechtigung Finanzen (Lesen).</p>
            </div>
        );
    }

    const addLine = () => setLines((prev) => [...prev, newRow()]);

    const invoiceFormCard = (
        <Card className="produkte-detail-card card--overflow-visible">
            <CardHeader
                title="Rechnung als PDF (FA-FIN-INVOICE)"
                subtitle="Leistung auswählen: nur Untersuchungs- & Behandlungszeilen der Patientenakte. Kosten und Gezahlt (i. S.) kommen aus den Buchungen."
                action={(
                    <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/verwaltung/finanzen-berichte/tagesabschluss")}>
                        Tagesabschluss
                    </Button>
                )}
            />
            <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {!canWriteZahlung ? (
                    <p style={{ color: "var(--fg-3)", fontSize: 14, margin: 0 }}>Nur mit Berechtigung Finanzen (Schreiben): Rechnung erzeugen.</p>
                ) : null}
                <Select
                    id="inv-wz-patient"
                    label="Empfänger (Patient)"
                    value={patientId}
                    disabled={!canWriteZahlung}
                    onChange={(e) => {
                        setPatientId(e.target.value);
                        setLines([newRow()]);
                    }}
                    options={[{ value: "", label: "– Patient –" }, ...patienten.map((p) => ({ value: p.id, label: p.name }))]}
                />
                <Input
                    id="inv-wz-num"
                    label="Rechnungsnummer (automatisch)"
                    value={rechnungNr || "— (Patient wählen)"}
                    readOnly
                    tabIndex={-1}
                />
                <Input id="inv-wz-date" type="date" label="Datum" value={invoiceDate} readOnly tabIndex={-1} />
                <Input
                    id="inv-wz-practice"
                    label="Praxis (Name)"
                    value={praxis.name}
                    readOnly
                    tabIndex={-1}
                />
                <Textarea
                    id="inv-wz-practice-addr"
                    label="Praxis (Adresse, je Zeile)"
                    value={praxis.addr}
                    readOnly
                    tabIndex={-1}
                />
                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                    Praxisname und -adresse aus App-Speicher (
                    <code>medoc-invoice-praxis-v1</code>
                    ). Optional später in Einstellungen pflegbar.
                </p>

                {aktenBusy ? <p className="page-sub" style={{ margin: 0 }}>Akte wird geladen…</p> : null}

                <div className="text-title" style={{ fontSize: 14, margin: "4px 0 0" }}>Leistungszeilen (B-/U-Akte)</div>
                {lines.map((row, idx) => (
                    <div
                        key={row.id}
                        className="card card-pad card--overflow-visible"
                        style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--surface-1)" }}
                    >
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>Leistung {idx + 1}</span>
                            {canWriteZahlung && lines.length > 1 ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setLines((prev) => prev.filter((x) => x.id !== row.id))}
                                >
                                    Zeile entfernen
                                </Button>
                            ) : null}
                        </div>
                        <Select
                            id={`inv-line-${row.id}`}
                            label="Leistungsbeschreibung (Untersuchung / Behandlung)"
                            value={row.link}
                            disabled={!canWriteZahlung || !patientId || linkOptions.length <= 1}
                            onChange={(e) => {
                                const v = e.target.value;
                                setLines((prev) => prev.map((r) => (r.id === row.id ? { ...r, link: v } : r)));
                            }}
                            options={linkOptionsPerRow(row, lines)}
                        />
                        {row.link
                            ? (() => {
                                const b = lineFromLeistungWahl(
                                    row.link,
                                    patientId,
                                    behandlungen,
                                    untersuchungen,
                                    patientZahlungen,
                                );
                                if (!b) {
                                    return <p className="page-sub" style={{ margin: 0 }}>Leistung nicht gefunden (Akte leeren?).</p>;
                                }
                                return (
                                    <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--fg-2)", whiteSpace: "pre-wrap" }}>{b.description}</div>
                                );
                            })()
                            : null}
                    </div>
                ))}

                {canWriteZahlung && patientId ? (
                    <div>
                        <Button type="button" size="sm" variant="secondary" onClick={addLine}>
                            Weitere Leistung
                        </Button>
                    </div>
                ) : null}

                <Input
                    id="inv-wz-line-total"
                    label="Betrag brutto (EUR) – Summe der Positionen"
                    value={builtLines.length > 0 ? formatCurrency(betragBruttoEur) : "—"}
                    readOnly
                    tabIndex={-1}
                />
                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>Berechnet aus Soll/Gezahlt je B-/U-Zeile (i. S. = im System, nicht storniert).</p>

                <Textarea
                    id="inv-wz-note"
                    label="Notiz auf der Rechnung (optional)"
                    value={note}
                    disabled={!canWriteZahlung}
                    onChange={(e) => setNote(e.target.value)}
                />
                {canWriteZahlung ? (
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <Button type="button" variant="ghost" onClick={resetForm} disabled={invBusy}>
                            Felder leeren
                        </Button>
                        <Button type="button" onClick={() => void handleInvoicePdf()} disabled={invBusy} loading={invBusy}>
                            PDF erzeugen
                        </Button>
                    </div>
                ) : null}
            </div>
        </Card>
    );

    const readModeCard = selectedEntry ? (
        <Card className="produkte-detail-card card--overflow-visible">
            <CardHeader
                title="Rechnung (Lesen)"
                subtitle={formatDateTime(selectedEntry.createdAt)}
                action={(
                    <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => void handleRedownloadInvoice(selectedEntry.invoice)}
                        disabled={invBusy}
                        loading={invBusy}
                    >
                        PDF erneut
                    </Button>
                )}
            />
            <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <Input id="read-inv-num" label="Rechnungsnummer" value={selectedEntry.invoice.number} readOnly tabIndex={-1} />
                <Input id="read-inv-date" type="date" label="Rechnungsdatum" value={selectedEntry.invoice.date} readOnly tabIndex={-1} />
                <Input id="read-rec" label="Empfänger" value={selectedEntry.invoice.recipient_name} readOnly tabIndex={-1} />
                <Textarea
                    id="read-rec-addr"
                    label="Adresse (Empfänger)"
                    value={selectedEntry.invoice.recipient_address.join("\n")}
                    readOnly
                    tabIndex={-1}
                />
                <Input id="read-pr" label="Praxis" value={selectedEntry.invoice.practice_name} readOnly tabIndex={-1} />
                <Textarea
                    id="read-pr-addr"
                    label="Praxis (Adresse)"
                    value={selectedEntry.invoice.practice_address.join("\n")}
                    readOnly
                    tabIndex={-1}
                />
                <p className="text-title" style={{ fontSize: 14, margin: 0 }}>Positionen</p>
                {selectedEntry.invoice.lines.map((line, i) => (
                    <div key={i} className="card card-pad" style={{ background: "var(--surface-1)" }}>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--fg-2)", whiteSpace: "pre-wrap" }}>{line.description}</p>
                        <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>
                            {formatCurrency(line.amount_cents / 100)}
                        </p>
                    </div>
                ))}
                <Input
                    id="read-sum"
                    label="Summe brutto (EUR)"
                    value={formatCurrency(sumInvoiceEur(selectedEntry.invoice))}
                    readOnly
                    tabIndex={-1}
                />
                {selectedEntry.invoice.note ? (
                    <Textarea id="read-note" label="Notiz" value={selectedEntry.invoice.note} readOnly tabIndex={-1} />
                ) : null}
                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                    Verlauf in der Datenbank (
                    <code>rechnung_document</code>
                    {") "}
                    — maximal
                    {" "}
                    {INVOICE_HISTORY_MAX}
                    {" "}
                    Einträge in der Ansicht.
                </p>
            </div>
        </Card>
    ) : null;

    const emptyDetail = (
        <Card className="produkte-detail-card produkte-detail-card--empty">
            <div className="card-pad">
                <EmptyState
                    title="Keine Rechnung gewählt"
                    description={
                        canWriteZahlung
                            ? "Links eine Zeile im Verlauf wählen oder „+ Neue Rechnung“ für eine neue Rechnung."
                            : "Wählen Sie links eine Rechnung aus dem Verlauf (nur Lesen: kein neues PDF anlegen)."
                    }
                />
            </div>
        </Card>
    );

    const rightColumn = creating
        ? invoiceFormCard
        : selectedEntry
            ? readModeCard
            : emptyDetail;

    return (
        <div className="rechnung-pdf-page animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
                <VerwaltungBackButton />
            </div>
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h1 className="page-title" style={{ margin: 0 }}>Rechnung (PDF)</h1>
                    <p className="page-sub" style={{ maxWidth: 720, marginTop: 8 }}>
                        Teil von
                        {" "}
                        <strong>Finanzen &amp; Berichte</strong>
                        {" "}
                        — Rechnung aus dem Druck-Backend, Leistung aus der Akte; Verlauf in SQLite. Tagesbericht/Abgleich:
                        {" "}
                        <button
                            type="button"
                            style={{ color: "var(--accent, #0a6)", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit" }}
                            onClick={() => navigate("/verwaltung/finanzen-berichte/tagesabschluss")}
                        >
                            Tagesabschluss
                        </button>
                        .
                    </p>
                </div>
                {canWriteZahlung ? (
                    <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                        {creating ? "Neue Rechnung abbrechen" : "+ Neue Rechnung"}
                    </Button>
                ) : null}
            </div>

            <div className="produkte-workspace">
                <div className="produkte-workspace__list">
                    <p className="text-title" style={{ margin: "0 0 8px", fontSize: 13 }}>Rechnungsverlauf</p>
                    {invoiceHistory.length === 0 ? (
                        <p className="page-sub" style={{ margin: 0, fontSize: 14 }}>
                            Noch keine Rechnung erzeugt. Mit „+ Neue Rechnung“ starten.
                        </p>
                    ) : (
                        <div className="card produkte-table-card" style={{ overflow: "auto" }}>
                            <table className="tbl produkte-tbl" style={{ minWidth: 420, fontSize: 14, margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th scope="col" style={{ textAlign: "left" }}>Rechnung</th>
                                        <th scope="col" style={{ textAlign: "left" }}>Datum</th>
                                        <th scope="col" style={{ textAlign: "left" }}>Empfänger</th>
                                        <th scope="col" style={{ textAlign: "right" }}>Summe</th>
                                        <th scope="col" style={{ textAlign: "left" }}>Erzeugt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoiceHistory.map((h) => {
                                        const isSel = !creating && selectedHistoryId === h.id;
                                        return (
                                            <tr
                                                key={h.id}
                                                className={isSel ? "produkte-row--selected" : undefined}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => selectHistoryRow(h.id)}
                                            >
                                                <td>
                                                    <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{h.invoice.number}</span>
                                                </td>
                                                <td style={{ whiteSpace: "nowrap" }}>{formatDate(h.invoice.date)}</td>
                                                <td style={{ maxWidth: 160 }} title={h.invoice.recipient_name}>
                                                    {h.invoice.recipient_name.length > 28
                                                        ? `${h.invoice.recipient_name.slice(0, 28)}…`
                                                        : h.invoice.recipient_name}
                                                </td>
                                                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                    {formatCurrency(sumInvoiceEur(h.invoice))}
                                                </td>
                                                <td className="page-sub" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                                                    {formatDateTime(h.createdAt)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="produkte-workspace__detail">{rightColumn}</div>
            </div>
        </div>
    );
}
