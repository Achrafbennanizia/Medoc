import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAkte, listBehandlungen, listUntersuchungen } from "@/systems/practice-host/controllers/akte.controller";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { allocateRechnungsnummer, renderInvoicePdf } from "@/systems/practice-host/controllers/invoice.controller";
import { listZahlungenForPatient } from "@/systems/practice-host/controllers/zahlung.controller";
import type { InvoiceInput } from "@/systems/practice-host/controllers/invoice.controller";
import {
    appendRechnungDocument,
    INVOICE_HISTORY_MAX,
    listRechnungDocuments,
    migrateLegacyInvoiceHistoryFromLocalStorageOnce,
    sumInvoiceEur,
    type SavedInvoice,
} from "@/systems/practice-host/controllers/rechnung-document.controller";
import {
    getInvoicePraxisFromStorage,
    buildInvoiceHeaderAddressLinesForExport,
    lineFromLeistungWahl,
} from "@/lib/invoice-leistung";
import { checkPraxisDocumentReadiness } from "@/lib/praxis-completeness";
import { PraxisReadinessDialog } from "../components/praxis-readiness-dialog";
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
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { useT, useTParams } from "@/lib/i18n";

const todayYmd = () => new Date().toISOString().slice(0, 10);

type LineRow = { id: string; link: string };

const newRow = (): LineRow => ({ id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, link: "" });

/**
 * Invoice (PDF) — FA-FIN-INVOICE: B/U lines from patient Akte, number/practice/date/gross automatic.
 */
export function VerwaltungFinanzWerkzeugePage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canWriteZahlung = role != null && allowed("finanzen.write", role);
    const canReadFinanzen = role != null && allowed("finanzen.read", role);

    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [patientZahlungen, setPatientZahlungen] = useState<Zahlung[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [invBusy, setInvBusy] = useState(false);
    const [praxisGuardOpen, setPraxisGuardOpen] = useState(false);
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
                toast(tp("page.verwaltung_finanz_werkzeuge.toast.history_error", { message: errorMessage(e) }), "error");
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
                    toast(tp("page.verwaltung_finanz_werkzeuge.toast.akte_error", { message: errorMessage(e) }), "error");
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

    const linkOptions = useMemo(
        () => buildZahlLinkSelectOptions(behandlungen, untersuchungen, t, tp),
        [behandlungen, untersuchungen, t, tp],
    );

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
        const readiness = checkPraxisDocumentReadiness(praxis, "rechnung");
        if (!readiness.ready) {
            setPraxisGuardOpen(true);
            return;
        }
        const p = patienten.find((x) => x.id === patientId);
        if (!p) {
            toast(t("page.verwaltung_finanz_werkzeuge.toast.choose_patient"));
            return;
        }
        if (aktenBusy) {
            toast(t("page.verwaltung_finanz_werkzeuge.toast.akte_loading"));
            return;
        }
        const withLinks = lines.filter((x) => x.link);
        if (withLinks.length === 0) {
            toast(t("page.verwaltung_finanz_werkzeuge.toast.need_line"));
            return;
        }
        const pdfLines = withLinks
            .map((row) => lineFromLeistungWahl(row.link, patientId, behandlungen, untersuchungen, patientZahlungen))
            .filter((x): x is NonNullable<typeof x> => x != null);
        if (pdfLines.length === 0) {
            toast(t("page.verwaltung_finanz_werkzeuge.toast.lines_failed"));
            return;
        }
        const h = await listRechnungDocuments(INVOICE_HISTORY_MAX);
        const reservedNums = new Set(h.map((x) => x.invoice.number.trim()));
        const num =
            rechnungNr.trim()
            || (await allocateRechnungsnummer(invoiceDate, { reserved: reservedNums }));
        const bankLines: string[] = [];
        const iban = (praxis.bankverbindung_iban ?? "").trim();
        if (iban) {
            const bic = (praxis.bankverbindung_bic ?? "").trim();
            const bankName = (praxis.bankverbindung_bank ?? "").trim();
            bankLines.push(
                `Bankverbindung: IBAN ${iban}${bic ? ` BIC ${bic}` : ""}${bankName ? ` (${bankName})` : ""}`,
            );
            const inh = (praxis.bankverbindung_inhaber ?? "").trim() || (praxis.behandler_name ?? "").trim();
            if (inh) bankLines.push(`Kontoinhaber: ${inh}`);
        }
        const zt = praxis.zahlungsziel_tage ?? 14;
        const payload: InvoiceInput = {
            number: num,
            date: invoiceDate,
            recipient_name: p.name,
            recipient_address: p.adresse
                ? p.adresse.split("\n").map((s) => s.trim()).filter(Boolean)
                : ["–"],
            practice_name: praxis.name.trim(),
            practice_address: buildInvoiceHeaderAddressLinesForExport(praxis),
            lines: pdfLines.map((l) => ({ description: l.description, amount_cents: l.amount_cents })),
            note: note.trim() || null,
            behandler_name: praxis.behandler_name?.trim() || null,
            behandler_zanr: praxis.zanr?.trim() || null,
            praxis_bsnr: praxis.bsnr?.trim() || null,
            bankverbindung: bankLines.length > 0 ? bankLines : null,
            zahlungsziel_text: `Zahlbar innerhalb von ${zt} Tagen.`,
            ust_hinweis: praxis.ust_befreiung_hinweis?.trim() || null,
        };
        setInvBusy(true);
        try {
            const bytes = await renderInvoicePdf(payload);
            openExportPreview({
                format: "pdf",
                title: t("page.verwaltung_finanz_werkzeuge.pdf_preview_title"),
                hint: tp("page.verwaltung_finanz_werkzeuge.pdf_preview_hint", { number: num, date: invoiceDate }),
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
            toast(t("page.verwaltung_finanz_werkzeuge.toast.pdf_saved"), "success");
        } catch (e) {
            toast(tp("page.verwaltung_finanz_werkzeuge.toast.error", { message: e instanceof Error ? e.message : String(e) }), "error");
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
                title: t("page.verwaltung_finanz_werkzeuge.export_again_title"),
                hint: tp("page.verwaltung_finanz_werkzeuge.toast.redownload_hint", { number: inv.number }),
                suggestedFilename: `rechnung-${inv.number.replace(/[^\w.-]+/g, "_")}.pdf`,
                binaryBody: new Uint8Array(bytes),
            });
        } catch (e) {
            toast(tp("page.verwaltung_finanz_werkzeuge.toast.error", { message: e instanceof Error ? e.message : String(e) }), "error");
        } finally {
            setInvBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader titleLevel="h1" title={t("page.verwaltung_finanz_werkzeuge.title")} />
                <PageLoading label={t("page.verwaltung_finanz_werkzeuge.loading")} />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader titleLevel="h1" title={t("page.verwaltung_finanz_werkzeuge.title")} />
                <PageLoadError message={loadError} onRetry={() => void load()} />
            </div>
        );
    }

    if (!canReadFinanzen) {
        return (
            <div className="praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader
                    titleLevel="h1"
                    title={t("page.verwaltung_finanz_werkzeuge.title")}
                    subtitle={t("page.verwaltung_finanz_werkzeuge.no_permission_read")}
                />
            </div>
        );
    }

    const addLine = () => setLines((prev) => [...prev, newRow()]);

    const invoiceFormCard = (
        <Card className="produkte-detail-card card--overflow-visible">
            <CardHeader
                title={t("page.verwaltung_finanz_werkzeuge.form_title")}
                subtitle={t("page.verwaltung_finanz_werkzeuge.form_subtitle")}
                action={(
                    <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/verwaltung/finanzen-berichte/tagesabschluss")}>
                        {t("page.verwaltung_finanz_werkzeuge.tagesabschluss_btn")}
                    </Button>
                )}
            />
            <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {!canWriteZahlung ? (
                    <p style={{ color: "var(--fg-3)", fontSize: 14, margin: 0 }}>{t("page.verwaltung_finanz_werkzeuge.no_permission_write")}</p>
                ) : null}
                <Select
                    id="inv-wz-patient"
                    label={t("page.verwaltung_finanz_werkzeuge.recipient")}
                    value={patientId}
                    disabled={!canWriteZahlung}
                    onChange={(e) => {
                        setPatientId(e.target.value);
                        setLines([newRow()]);
                    }}
                    options={[{ value: "", label: t("page.verwaltung_finanz_werkzeuge.choose_patient") }, ...patienten.map((p) => ({ value: p.id, label: p.name }))]}
                />
                <Input
                    id="inv-wz-num"
                    label={t("page.verwaltung_finanz_werkzeuge.invoice_number_auto")}
                    value={rechnungNr || t("page.verwaltung_finanz_werkzeuge.choose_patient_ph")}
                    readOnly
                    tabIndex={-1}
                />
                <Input id="inv-wz-date" type="date" label={t("common.date")} value={invoiceDate} readOnly tabIndex={-1} />
                <Input
                    id="inv-wz-practice"
                    label={t("page.verwaltung_finanz_werkzeuge.practice_name")}
                    value={praxis.name}
                    readOnly
                    tabIndex={-1}
                />
                <Textarea
                    id="inv-wz-practice-addr"
                    label={t("page.verwaltung_finanz_werkzeuge.practice_addr")}
                    value={praxis.addr}
                    readOnly
                    tabIndex={-1}
                />
                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                    {t("page.verwaltung_finanz_werkzeuge.practice_hint")}
                </p>

                {aktenBusy ? <p className="page-sub" style={{ margin: 0 }}>{t("page.verwaltung_finanz_werkzeuge.akte_loading")}</p> : null}

                <div className="text-title" style={{ fontSize: 14, margin: "4px 0 0" }}>{t("page.verwaltung_finanz_werkzeuge.lines_title")}</div>
                {lines.map((row, idx) => (
                    <div
                        key={row.id}
                        className="card card-pad card--overflow-visible"
                        style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--surface-1)" }}
                    >
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>{tp("page.verwaltung_finanz_werkzeuge.line_n", { index: idx + 1 })}</span>
                            {canWriteZahlung && lines.length > 1 ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setLines((prev) => prev.filter((x) => x.id !== row.id))}
                                >
                                    {t("page.verwaltung_finanz_werkzeuge.remove_line")}
                                </Button>
                            ) : null}
                        </div>
                        <Select
                            id={`inv-line-${row.id}`}
                            label={t("page.verwaltung_finanz_werkzeuge.line_desc")}
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
                                    return <p className="page-sub" style={{ margin: 0 }}>{t("page.verwaltung_finanz_werkzeuge.line_not_found")}</p>;
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
                            {t("page.verwaltung_finanz_werkzeuge.add_line")}
                        </Button>
                    </div>
                ) : null}

                <Input
                    id="inv-wz-line-total"
                    label={t("page.verwaltung_finanz_werkzeuge.amount_gross")}
                    value={builtLines.length > 0 ? formatCurrency(betragBruttoEur) : "—"}
                    readOnly
                    tabIndex={-1}
                />
                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>{t("page.verwaltung_finanz_werkzeuge.amount_hint")}</p>

                <Textarea
                    id="inv-wz-note"
                    label={t("page.verwaltung_finanz_werkzeuge.note_label")}
                    value={note}
                    disabled={!canWriteZahlung}
                    onChange={(e) => setNote(e.target.value)}
                />
                {canWriteZahlung ? (
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <Button type="button" variant="ghost" onClick={resetForm} disabled={invBusy}>
                            {t("page.verwaltung_finanz_werkzeuge.clear_fields")}
                        </Button>
                        <Button type="button" onClick={() => void handleInvoicePdf()} disabled={invBusy} loading={invBusy}>
                            {t("page.verwaltung_finanz_werkzeuge.generate_pdf")}
                        </Button>
                    </div>
                ) : null}
            </div>
        </Card>
    );

    const readModeCard = selectedEntry ? (
        <Card className="produkte-detail-card card--overflow-visible">
            <CardHeader
                title={t("page.verwaltung_finanz_werkzeuge.read_mode")}
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
                        {t("page.verwaltung_finanz_werkzeuge.export_again")}
                    </Button>
                )}
            />
            <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <Input id="read-inv-num" label={t("page.verwaltung_finanz_werkzeuge.invoice_number")} value={selectedEntry.invoice.number} readOnly tabIndex={-1} />
                <Input id="read-inv-date" type="date" label={t("page.verwaltung_finanz_werkzeuge.invoice_date")} value={selectedEntry.invoice.date} readOnly tabIndex={-1} />
                <Input id="read-rec" label={t("common.recipient")} value={selectedEntry.invoice.recipient_name} readOnly tabIndex={-1} />
                <Textarea
                    id="read-rec-addr"
                    label={t("page.verwaltung_finanz_werkzeuge.read_addr")}
                    value={selectedEntry.invoice.recipient_address.join("\n")}
                    readOnly
                    tabIndex={-1}
                />
                <Input id="read-pr" label={t("page.verwaltung_finanz_werkzeuge.practice_name")} value={selectedEntry.invoice.practice_name} readOnly tabIndex={-1} />
                <Textarea
                    id="read-pr-addr"
                    label={t("page.verwaltung_finanz_werkzeuge.read_practice_addr")}
                    value={selectedEntry.invoice.practice_address.join("\n")}
                    readOnly
                    tabIndex={-1}
                />
                <p className="text-title" style={{ fontSize: 14, margin: 0 }}>{t("common.positions")}</p>
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
                    label={t("common.sum_gross")}
                    value={formatCurrency(sumInvoiceEur(selectedEntry.invoice))}
                    readOnly
                    tabIndex={-1}
                />
                {selectedEntry.invoice.note ? (
                    <Textarea id="read-note" label={t("common.note")} value={selectedEntry.invoice.note} readOnly tabIndex={-1} />
                ) : null}
                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                    {tp("page.verwaltung_finanz_werkzeuge.history_hint", { max: INVOICE_HISTORY_MAX })}
                </p>
            </div>
        </Card>
    ) : null;

    const emptyDetail = (
        <Card className="produkte-detail-card produkte-detail-card--empty">
            <div className="card-pad">
                <EmptyState
                    title={t("page.verwaltung_finanz_werkzeuge.empty_title")}
                    description={
                        canWriteZahlung
                            ? t("page.verwaltung_finanz_werkzeuge.empty_desc_write")
                            : t("page.verwaltung_finanz_werkzeuge.empty_desc_read")
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
        <div className="rechnung-pdf-page praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                titleLevel="h1"
                title={t("page.verwaltung_finanz_werkzeuge.title")}
                subtitle={
                    <>
                        {t("page.verwaltung_finanz_werkzeuge.subtitle_part1")}{" "}
                        <button
                            type="button"
                            style={{ color: "var(--accent, #0a6)", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit" }}
                            onClick={() => navigate("/verwaltung/finanzen-berichte/tagesabschluss")}
                        >
                            {t("page.verwaltung_finanz_werkzeuge.subtitle_tagesabschluss")}
                        </button>
                        .
                    </>
                }
                actions={
                    canWriteZahlung ? (
                        <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                            {creating ? t("page.verwaltung_finanz_werkzeuge.cancel_create") : t("page.verwaltung_finanz_werkzeuge.create_title")}
                        </Button>
                    ) : null
                }
            />

            <div className="produkte-workspace">
                <div className="produkte-workspace__list">
                    <p className="text-title" style={{ margin: "0 0 8px", fontSize: 13 }}>{t("page.verwaltung_finanz_werkzeuge.history_title")}</p>
                    {invoiceHistory.length === 0 ? (
                        <p className="page-sub" style={{ margin: 0, fontSize: 14 }}>
                            {t("page.verwaltung_finanz_werkzeuge.history_empty")}
                        </p>
                    ) : (
                        <div className="card produkte-table-card" style={{ overflow: "auto" }}>
                            <table className="tbl produkte-tbl tbl-fluid" style={{ fontSize: 14, margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th scope="col" style={{ textAlign: "left" }}>{t("page.verwaltung_finanz_werkzeuge.col.invoice")}</th>
                                        <th scope="col" style={{ textAlign: "left" }}>{t("common.date")}</th>
                                        <th scope="col" style={{ textAlign: "left" }}>{t("common.recipient")}</th>
                                        <th scope="col" style={{ textAlign: "end" }}>{t("common.sum_gross")}</th>
                                        <th scope="col" style={{ textAlign: "left" }}>{t("page.verwaltung_finanz_werkzeuge.col.created")}</th>
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
                                                <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>
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
            <PraxisReadinessDialog
                open={praxisGuardOpen}
                documentKind="rechnung"
                result={checkPraxisDocumentReadiness(praxis, "rechnung")}
                onClose={() => setPraxisGuardOpen(false)}
            />
        </div>
    );
}
