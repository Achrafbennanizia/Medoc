import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getChart, listTreatments, listExaminations } from "@/systems/practice-host/controllers/chart.controller";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { allocateInvoiceNumber, renderInvoicePdf } from "@/systems/practice-host/controllers/invoice.controller";
import { listPaymentsForPatient } from "@/systems/practice-host/controllers/payment.controller";
import type { InvoiceInput } from "@/systems/practice-host/controllers/invoice.controller";
import {
    appendInvoiceDocument,
    INVOICE_HISTORY_MAX,
    listInvoiceDocuments,
    migrateLegacyInvoiceHistoryFromLocalStorageOnce,
    sumInvoiceEur,
    type SavedInvoice,
} from "@/systems/practice-host/controllers/invoice-document.controller";
import {
    getInvoicePracticeFromStorage,
    buildInvoiceHeaderAddressLinesForExport,
    lineFromServiceItemChoice,
} from "@/lib/invoice-service-item";
import { checkPracticeDocumentReadiness } from "@/lib/practice-completeness";
import { PracticeReadinessDialog } from "../components/practice-readiness-dialog";
import { buildPaymentLinkSelectOptions } from "@/lib/payment-booking";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { openExportPreview } from "@/models/store/export-preview-store";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { Treatment, Patient, Examination, Payment } from "@/models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Textarea, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { useT, useTParams } from "@/lib/i18n";

const todayYmd = () => new Date().toISOString().slice(0, 10);

type LineRow = { id: string; link: string };

const newRow = (): LineRow => ({ id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, link: "" });

/**
 * Invoice (PDF) — FA-FIN-INVOICE: B/U lines from patient Chart, number/practice/date/gross automatic.
 */
export function AdministrationFinanceToolsPage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canWritePayment = role != null && allowed("finance.write", role);
    const canReadFinance = role != null && allowed("finance.read", role);

    const [patients, setPatients] = useState<Patient[]>([]);
    const [patientPayments, setPatientPayments] = useState<Payment[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [invBusy, setInvBusy] = useState(false);
    const [practiceGuardOpen, setPracticeGuardOpen] = useState(false);
    const [patientId, setPatientId] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(() => todayYmd());
    const [invoiceNr, setInvoiceNr] = useState("");
    const [invoiceHistory, setInvoiceHistory] = useState<SavedInvoice[]>([]);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [practice, setPractice] = useState(getInvoicePracticeFromStorage);
    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [examinations, setExaminations] = useState<Examination[]>([]);
    const [chartsBusy, setChartsBusy] = useState(false);
    const [lines, setLines] = useState<LineRow[]>(() => [newRow()]);
    const [note, setNote] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const pats = await listPatients();
            setPatients(pats);
            setPractice(getInvoicePracticeFromStorage());
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
            if (canWritePayment) {
                await migrateLegacyInvoiceHistoryFromLocalStorageOnce();
            }
            try {
                const h = await listInvoiceDocuments(INVOICE_HISTORY_MAX);
                setInvoiceHistory(h);
                if (h.length > 0) {
                    setSelectedHistoryId((cur) => cur ?? h[0]!.id);
                }
            } catch (e) {
                toast(tp("page.administration_finance_tools.toast.history_error", { message: errorMessage(e) }), "error");
                setInvoiceHistory([]);
            }
        })();
    }, [canWritePayment, toast]);

    useEffect(() => {
        if (!patientId) {
            setInvoiceNr("");
            setTreatments([]);
            setExaminations([]);
            setPatientPayments([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const h = await listInvoiceDocuments(INVOICE_HISTORY_MAX);
                const reserved = new Set(h.map((x) => x.invoice.number.trim()));
                const n = await allocateInvoiceNumber(invoiceDate, { reserved });
                if (!cancelled) setInvoiceNr(n);
            } catch {
                if (!cancelled) setInvoiceNr("");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [patientId, invoiceDate]);

    useEffect(() => {
        if (!patientId) return;
        let cancel = false;
        setChartsBusy(true);
        (async () => {
            try {
                const chart = await getChart(patientId);
                if (cancel) return;
                const [b, u, z] = await Promise.all([
                    listTreatments(chart.id),
                    listExaminations(chart.id),
                    listPaymentsForPatient(patientId),
                ]);
                if (!cancel) {
                    setTreatments(b);
                    setExaminations(u);
                    setPatientPayments(z);
                }
            } catch (e) {
                if (!cancel) {
                    setTreatments([]);
                    setExaminations([]);
                    setPatientPayments([]);
                    toast(tp("page.administration_finance_tools.toast.chart_error", { message: errorMessage(e) }), "error");
                }
            } finally {
                if (!cancel) setChartsBusy(false);
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
        () => buildPaymentLinkSelectOptions(treatments, examinations, t, tp),
        [treatments, examinations, t, tp],
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
            .map((row) => (row.link ? lineFromServiceItemChoice(row.link, patientId, treatments, examinations, patientPayments) : null))
            .filter((x): x is NonNullable<typeof x> => x != null);
    }, [patientId, lines, treatments, examinations, patientPayments]);

    const amountBruttoEur = useMemo(
        () => (builtLines.length > 0 ? builtLines.reduce((s, l) => s + l.amount_cents, 0) / 100 : 0),
        [builtLines],
    );

    const handleInvoicePdf = async () => {
        const readiness = checkPracticeDocumentReadiness(practice, "invoice");
        if (!readiness.ready) {
            setPracticeGuardOpen(true);
            return;
        }
        const p = patients.find((x) => x.id === patientId);
        if (!p) {
            toast(t("page.administration_finance_tools.toast.choose_patient"));
            return;
        }
        if (chartsBusy) {
            toast(t("page.administration_finance_tools.toast.chart_loading"));
            return;
        }
        const withLinks = lines.filter((x) => x.link);
        if (withLinks.length === 0) {
            toast(t("page.administration_finance_tools.toast.need_line"));
            return;
        }
        const pdfLines = withLinks
            .map((row) => lineFromServiceItemChoice(row.link, patientId, treatments, examinations, patientPayments))
            .filter((x): x is NonNullable<typeof x> => x != null);
        if (pdfLines.length === 0) {
            toast(t("page.administration_finance_tools.toast.lines_failed"));
            return;
        }
        const h = await listInvoiceDocuments(INVOICE_HISTORY_MAX);
        const reservedNums = new Set(h.map((x) => x.invoice.number.trim()));
        const num =
            invoiceNr.trim()
            || (await allocateInvoiceNumber(invoiceDate, { reserved: reservedNums }));
        const bankLines: string[] = [];
        const iban = (practice.bankverbindung_iban ?? "").trim();
        if (iban) {
            const bic = (practice.bankverbindung_bic ?? "").trim();
            const bankName = (practice.bankverbindung_bank ?? "").trim();
            bankLines.push(
                `Bank details: IBAN ${iban}${bic ? ` BIC ${bic}` : ""}${bankName ? ` (${bankName})` : ""}`,
            );
            const inh = (practice.bankverbindung_inhaber ?? "").trim() || (practice.clinician_name ?? "").trim();
            if (inh) bankLines.push(`Account holder: ${inh}`);
        }
        const zt = practice.payment_terms_tage ?? 14;
        const payload: InvoiceInput = {
            number: num,
            date: invoiceDate,
            recipient_name: p.name,
            recipient_address: p.address
                ? p.address.split("\n").map((s) => s.trim()).filter(Boolean)
                : ["–"],
            practice_name: practice.name.trim(),
            practice_address: buildInvoiceHeaderAddressLinesForExport(practice),
            lines: pdfLines.map((l) => ({ description: l.description, amount_cents: l.amount_cents })),
            note: note.trim() || null,
            clinician_name: practice.clinician_name?.trim() || null,
            clinician_zanr: practice.zanr?.trim() || null,
            practice_bsnr: practice.bsnr?.trim() || null,
            bank_details: bankLines.length > 0 ? bankLines : null,
            payment_terms_text: `Payable within ${zt} days.`,
            vat_notice: practice.ust_befreiung_hinweis?.trim() || null,
        };
        setInvBusy(true);
        try {
            const bytes = await renderInvoicePdf(payload);
            openExportPreview({
                format: "pdf",
                title: t("page.administration_finance_tools.pdf_preview_title"),
                hint: tp("page.administration_finance_tools.pdf_preview_hint", { number: num, date: invoiceDate }),
                suggestedFilename: `invoice-${num.replace(/[^\w.-]+/g, "_")}.pdf`,
                binaryBody: new Uint8Array(bytes),
            });
            const newId =
                globalThis.crypto?.randomUUID != null
                    ? globalThis.crypto.randomUUID()
                    : `re-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            await appendInvoiceDocument({
                id: newId,
                createdAt: new Date().toISOString(),
                patientId,
                invoice: payload,
            });
            setInvoiceHistory(await listInvoiceDocuments(INVOICE_HISTORY_MAX));
            setSelectedHistoryId(newId);
            setCreating(false);
            toast(t("page.administration_finance_tools.toast.pdf_saved"), "success");
        } catch (e) {
            toast(tp("page.administration_finance_tools.toast.error", { message: e instanceof Error ? e.message : String(e) }), "error");
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
        void listInvoiceDocuments(INVOICE_HISTORY_MAX).then((h) => {
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
                title: t("page.administration_finance_tools.export_again_title"),
                hint: tp("page.administration_finance_tools.toast.redownload_hint", { number: inv.number }),
                suggestedFilename: `invoice-${inv.number.replace(/[^\w.-]+/g, "_")}.pdf`,
                binaryBody: new Uint8Array(bytes),
            });
        } catch (e) {
            toast(tp("page.administration_finance_tools.toast.error", { message: e instanceof Error ? e.message : String(e) }), "error");
        } finally {
            setInvBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="practice-workspace-page animate-fade-in">
                <AdministrationPageHeader titleLevel="h1" title={t("page.administration_finance_tools.title")} />
                <PageLoading label={t("page.administration_finance_tools.loading")} />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="practice-workspace-page animate-fade-in">
                <AdministrationPageHeader titleLevel="h1" title={t("page.administration_finance_tools.title")} />
                <PageLoadError message={loadError} onRetry={() => void load()} />
            </div>
        );
    }

    if (!canReadFinance) {
        return (
            <div className="practice-workspace-page animate-fade-in">
                <AdministrationPageHeader
                    titleLevel="h1"
                    title={t("page.administration_finance_tools.title")}
                    subtitle={t("page.administration_finance_tools.no_permission_read")}
                />
            </div>
        );
    }

    const addLine = () => setLines((prev) => [...prev, newRow()]);

    const invoiceFormCard = (
        <Card className="products-detail-card card--overflow-visible">
            <CardHeader
                title={t("page.administration_finance_tools.form_title")}
                subtitle={t("page.administration_finance_tools.form_subtitle")}
                action={(
                    <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/administration/finance-reports/day-close")}>
                        {t("page.administration_finance_tools.day_close_btn")}
                    </Button>
                )}
            />
            <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {!canWritePayment ? (
                    <p style={{ color: "var(--fg-3)", fontSize: 14, margin: 0 }}>{t("page.administration_finance_tools.no_permission_write")}</p>
                ) : null}
                <Select
                    id="inv-wz-patient"
                    label={t("page.administration_finance_tools.recipient")}
                    value={patientId}
                    disabled={!canWritePayment}
                    onChange={(e) => {
                        setPatientId(e.target.value);
                        setLines([newRow()]);
                    }}
                    options={[{ value: "", label: t("page.administration_finance_tools.choose_patient") }, ...patients.map((p) => ({ value: p.id, label: p.name }))]}
                />
                <Input
                    id="inv-wz-num"
                    label={t("page.administration_finance_tools.invoice_number_auto")}
                    value={invoiceNr || t("page.administration_finance_tools.choose_patient_ph")}
                    readOnly
                    tabIndex={-1}
                />
                <Input id="inv-wz-date" type="date" label={t("common.date")} value={invoiceDate} readOnly tabIndex={-1} />
                <Input
                    id="inv-wz-practice"
                    label={t("page.administration_finance_tools.practice_name")}
                    value={practice.name}
                    readOnly
                    tabIndex={-1}
                />
                <Textarea
                    id="inv-wz-practice-addr"
                    label={t("page.administration_finance_tools.practice_addr")}
                    value={practice.addr}
                    readOnly
                    tabIndex={-1}
                />
                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                    {t("page.administration_finance_tools.practice_hint")}
                </p>

                {chartsBusy ? <p className="page-sub" style={{ margin: 0 }}>{t("page.administration_finance_tools.chart_loading")}</p> : null}

                <div className="text-title" style={{ fontSize: 14, margin: "4px 0 0" }}>{t("page.administration_finance_tools.lines_title")}</div>
                {lines.map((row, idx) => (
                    <div
                        key={row.id}
                        className="card card-pad card--overflow-visible"
                        style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--surface-1)" }}
                    >
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>{tp("page.administration_finance_tools.line_n", { index: idx + 1 })}</span>
                            {canWritePayment && lines.length > 1 ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setLines((prev) => prev.filter((x) => x.id !== row.id))}
                                >
                                    {t("page.administration_finance_tools.remove_line")}
                                </Button>
                            ) : null}
                        </div>
                        <Select
                            id={`inv-line-${row.id}`}
                            label={t("page.administration_finance_tools.line_desc")}
                            value={row.link}
                            disabled={!canWritePayment || !patientId || linkOptions.length <= 1}
                            onChange={(e) => {
                                const version = e.target.value;
                                setLines((prev) => prev.map((r) => (r.id === row.id ? { ...r, link: version } : r)));
                            }}
                            options={linkOptionsPerRow(row, lines)}
                        />
                        {row.link
                            ? (() => {
                                const b = lineFromServiceItemChoice(
                                    row.link,
                                    patientId,
                                    treatments,
                                    examinations,
                                    patientPayments,
                                );
                                if (!b) {
                                    return <p className="page-sub" style={{ margin: 0 }}>{t("page.administration_finance_tools.line_not_found")}</p>;
                                }
                                return (
                                    <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--fg-2)", whiteSpace: "pre-wrap" }}>{b.description}</div>
                                );
                            })()
                            : null}
                    </div>
                ))}

                {canWritePayment && patientId ? (
                    <div>
                        <Button type="button" size="sm" variant="secondary" onClick={addLine}>
                            {t("page.administration_finance_tools.add_line")}
                        </Button>
                    </div>
                ) : null}

                <Input
                    id="inv-wz-line-total"
                    label={t("page.administration_finance_tools.amount_gross")}
                    value={builtLines.length > 0 ? formatCurrency(amountBruttoEur) : "—"}
                    readOnly
                    tabIndex={-1}
                />
                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>{t("page.administration_finance_tools.amount_hint")}</p>

                <Textarea
                    id="inv-wz-note"
                    label={t("page.administration_finance_tools.note_label")}
                    value={note}
                    disabled={!canWritePayment}
                    onChange={(e) => setNote(e.target.value)}
                />
                {canWritePayment ? (
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <Button type="button" variant="ghost" onClick={resetForm} disabled={invBusy}>
                            {t("page.administration_finance_tools.clear_fields")}
                        </Button>
                        <Button type="button" onClick={() => void handleInvoicePdf()} disabled={invBusy} loading={invBusy}>
                            {t("page.administration_finance_tools.generate_pdf")}
                        </Button>
                    </div>
                ) : null}
            </div>
        </Card>
    );

    const readModeCard = selectedEntry ? (
        <Card className="products-detail-card card--overflow-visible">
            <CardHeader
                title={t("page.administration_finance_tools.read_mode")}
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
                        {t("page.administration_finance_tools.export_again")}
                    </Button>
                )}
            />
            <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <Input id="read-inv-num" label={t("page.administration_finance_tools.invoice_number")} value={selectedEntry.invoice.number} readOnly tabIndex={-1} />
                <Input id="read-inv-date" type="date" label={t("page.administration_finance_tools.invoice_date")} value={selectedEntry.invoice.date} readOnly tabIndex={-1} />
                <Input id="read-rec" label={t("common.recipient")} value={selectedEntry.invoice.recipient_name} readOnly tabIndex={-1} />
                <Textarea
                    id="read-rec-addr"
                    label={t("page.administration_finance_tools.read_addr")}
                    value={selectedEntry.invoice.recipient_address.join("\n")}
                    readOnly
                    tabIndex={-1}
                />
                <Input id="read-pr" label={t("page.administration_finance_tools.practice_name")} value={selectedEntry.invoice.practice_name} readOnly tabIndex={-1} />
                <Textarea
                    id="read-pr-addr"
                    label={t("page.administration_finance_tools.read_practice_addr")}
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
                    {tp("page.administration_finance_tools.history_hint", { max: INVOICE_HISTORY_MAX })}
                </p>
            </div>
        </Card>
    ) : null;

    const emptyDetail = (
        <Card className="products-detail-card products-detail-card--empty">
            <div className="card-pad">
                <EmptyState
                    title={t("page.administration_finance_tools.empty_title")}
                    description={
                        canWritePayment
                            ? t("page.administration_finance_tools.empty_desc_write")
                            : t("page.administration_finance_tools.empty_desc_read")
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
        <div className="invoice-pdf-page practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                titleLevel="h1"
                title={t("page.administration_finance_tools.title")}
                subtitle={
                    <>
                        {t("page.administration_finance_tools.subtitle_part1")}{" "}
                        <button
                            type="button"
                            style={{ color: "var(--accent, #0a6)", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit" }}
                            onClick={() => navigate("/administration/finance-reports/day-close")}
                        >
                            {t("page.administration_finance_tools.subtitle_day_close")}
                        </button>
                        .
                    </>
                }
                actions={
                    canWritePayment ? (
                        <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                            {creating ? t("page.administration_finance_tools.cancel_create") : t("page.administration_finance_tools.create_title")}
                        </Button>
                    ) : null
                }
            />

            <div className="products-workspace">
                <div className="products-workspace__list">
                    <p className="text-title" style={{ margin: "0 0 8px", fontSize: 13 }}>{t("page.administration_finance_tools.history_title")}</p>
                    {invoiceHistory.length === 0 ? (
                        <p className="page-sub" style={{ margin: 0, fontSize: 14 }}>
                            {t("page.administration_finance_tools.history_empty")}
                        </p>
                    ) : (
                        <div className="card products-table-card" style={{ overflow: "auto" }}>
                            <table className="tbl products-tbl tbl-fluid" style={{ fontSize: 14, margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th scope="col" style={{ textAlign: "left" }}>{t("page.administration_finance_tools.col.invoice")}</th>
                                        <th scope="col" style={{ textAlign: "left" }}>{t("common.date")}</th>
                                        <th scope="col" style={{ textAlign: "left" }}>{t("common.recipient")}</th>
                                        <th scope="col" style={{ textAlign: "end" }}>{t("common.sum_gross")}</th>
                                        <th scope="col" style={{ textAlign: "left" }}>{t("page.administration_finance_tools.col.created")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoiceHistory.map((h) => {
                                        const isSel = !creating && selectedHistoryId === h.id;
                                        return (
                                            <tr
                                                key={h.id}
                                                className={isSel ? "products-row--selected" : undefined}
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
                <div className="products-workspace__detail">{rightColumn}</div>
            </div>
            <PracticeReadinessDialog
                open={practiceGuardOpen}
                documentKind="invoice"
                result={checkPracticeDocumentReadiness(practice, "invoice")}
                onClose={() => setPracticeGuardOpen(false)}
            />
        </div>
    );
}
