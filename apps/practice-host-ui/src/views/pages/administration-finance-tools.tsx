import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getChart, listTreatments, listExaminations } from "@/systems/practice-host/controllers/chart.controller";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { renderInvoicePdf } from "@/systems/practice-host/controllers/invoice.controller";
import {
    cancelIssuedInvoice,
    issueInvoice,
    issuedPdfBytes,
    pdfBase64ToBytes,
    reprintIssuedDocument,
} from "@/systems/practice-host/controllers/document.controller";
import { listPaymentsForPatient } from "@/systems/practice-host/controllers/payment.controller";
import type { InvoiceInput } from "@/systems/practice-host/controllers/invoice.controller";
import {
    INVOICE_HISTORY_MAX,
    issuePaymentReminder,
    listInvoiceDocuments,
    migrateLegacyInvoiceHistoryFromLocalStorageOnce,
    sumInvoiceEur,
    type InvoicePaymentState,
    type SavedInvoice,
} from "@/systems/practice-host/controllers/invoice-document.controller";
import { getInvoicePracticeFromStorage, lineFromServiceItemChoice } from "@/lib/invoice-service-item";
import { checkPracticeDocumentReadiness } from "@/lib/practice-completeness";
import { PracticeReadinessDialog } from "../components/practice-readiness-dialog";
import { buildOpenPaymentLinkSelectOptions } from "@/lib/payment-booking";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { openExportPreview } from "@/models/store/export-preview-store";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { Treatment, Patient, Examination, Payment } from "@/models/types";
import { Button } from "../components/ui/button";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Textarea, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { useT, useTParams } from "@/lib/i18n";

/** Local calendar date (toISOString() is UTC and gave yesterday's date after midnight). */
const todayYmd = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const STATE_STYLE: Record<InvoicePaymentState, { bg: string; fg: string }> = {
    OPEN: { bg: "var(--surface-2, #eef)", fg: "var(--fg-1)" },
    PARTIAL: { bg: "var(--warning-soft, rgba(180,120,0,.12))", fg: "var(--fg-1)" },
    OVERDUE: { bg: "var(--danger-soft, rgba(200,0,0,.12))", fg: "var(--danger, #b00)" },
    PAID: { bg: "var(--success-soft, rgba(0,120,80,.12))", fg: "var(--fg-1)" },
    CANCELLED: { bg: "var(--surface-2, #eee)", fg: "var(--fg-3)" },
    CANCELLATION: { bg: "var(--surface-2, #eee)", fg: "var(--fg-2)" },
    UNLINKED: { bg: "var(--surface-2, #eee)", fg: "var(--fg-3)" },
    LEGACY: { bg: "var(--surface-2, #eee)", fg: "var(--fg-3)" },
};

const totalOf = (h: SavedInvoice) => (h.totalCents != null ? h.totalCents / 100 : sumInvoiceEur(h.invoice));

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
    /** Invoice waiting for a cancellation reason (window.prompt is not available in Tauri webviews). */
    const [cancelTarget, setCancelTarget] = useState<SavedInvoice | null>(null);
    const [cancelReason, setCancelReason] = useState("");
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
    const [chartLoadedPatientId, setChartLoadedPatientId] = useState<string | null>(null);
    const [lines, setLines] = useState<LineRow[]>(() => [newRow()]);
    const [note, setNote] = useState("");
    /** Invoice to someone other than the patient (parent, guardian, payer). */
    const [altRecipient, setAltRecipient] = useState(false);
    const [recName, setRecName] = useState("");
    const [recAddr, setRecAddr] = useState("");
    const [issueConfirmOpen, setIssueConfirmOpen] = useState(false);
    const [historyFilter, setHistoryFilter] = useState<"all" | "open" | "overdue">("all");
    const [reminderTarget, setReminderTarget] = useState<SavedInvoice | null>(null);
    const [reminderFee, setReminderFee] = useState("");
    const [searchParams] = useSearchParams();
    const presetPatientId = searchParams.get("patientId") ?? "";
    const presetLink = searchParams.get("link") ?? "";
    const presetApplied = useRef(false);

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
    }, [canWritePayment, toast, tp]);

    useEffect(() => {
        if (!patientId) {
            setInvoiceNr("");
            setTreatments([]);
            setExaminations([]);
            setPatientPayments([]);
            return;
        }
        // The number is allocated by the server when the invoice is issued.
        // Reserving it here burned numbers when the form was abandoned (GoBD gaps).
        setInvoiceNr("");
    }, [patientId, invoiceDate]);

    useEffect(() => {
        if (!patientId) {
            setChartLoadedPatientId(null);
            return;
        }
        let cancel = false;
        setChartsBusy(true);
        setChartLoadedPatientId(null);
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
                if (!cancel) {
                    setChartsBusy(false);
                    setChartLoadedPatientId(patientId);
                }
            }
        })();
        return () => {
            cancel = true;
        };
    }, [patientId, toast, tp]);

    const selectedEntry = useMemo(
        () => invoiceHistory.find((x) => x.id === selectedHistoryId) ?? null,
        [invoiceHistory, selectedHistoryId],
    );

    const linkOptions = useMemo(
        () =>
            patientId
                ? buildOpenPaymentLinkSelectOptions(patientPayments, patientId, treatments, examinations, t, tp)
                : [{ value: "", label: t("payment.link.select_placeholder") }],
        [patientPayments, patientId, treatments, examinations, t, tp],
    );

    useEffect(() => {
        if (!presetPatientId) return;
        setPatientId(presetPatientId);
        setCreating(true);
    }, [presetPatientId]);

    useEffect(() => {
        if (presetApplied.current || !presetPatientId || !presetLink) return;
        if (chartLoadedPatientId !== presetPatientId || chartsBusy) return;
        presetApplied.current = true;
        if (linkOptions.some((option) => option.value === presetLink)) {
            setLines([{ id: "preset", link: presetLink }]);
        }
    }, [presetPatientId, presetLink, chartLoadedPatientId, chartsBusy, linkOptions]);

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

    /** Builds the request; returns null (with a toast) when something is missing. */
    const buildPayload = (): InvoiceInput | null => {
        const readiness = checkPracticeDocumentReadiness(practice, "invoice");
        if (!readiness.ready) {
            setPracticeGuardOpen(true);
            return null;
        }
        const p = patients.find((x) => x.id === patientId);
        if (!p) {
            toast(t("page.administration_finance_tools.toast.choose_patient"));
            return null;
        }
        if (chartsBusy) {
            toast(t("page.administration_finance_tools.toast.chart_loading"));
            return null;
        }
        const withLinks = lines.filter((x) => x.link);
        if (withLinks.length === 0) {
            toast(t("page.administration_finance_tools.toast.need_line"));
            return null;
        }
        const pdfLines = withLinks
            .map((row) => lineFromServiceItemChoice(row.link, patientId, treatments, examinations, patientPayments))
            .filter((x): x is NonNullable<typeof x> => x != null);
        if (pdfLines.length === 0) {
            toast(t("page.administration_finance_tools.toast.lines_failed"));
            return null;
        }
        if (altRecipient && (!recName.trim() || !recAddr.trim())) {
            toast(t("page.administration_finance_tools.toast.recipient_missing"), "error");
            return null;
        }
        // Content only — practice identity, patient name/DOB, number, bank and
        // tax data are filled in by the server from the database.
        return {
            number: "",
            date: invoiceDate,
            recipient_name: altRecipient ? recName.trim() : p.name,
            recipient_address: (altRecipient ? recAddr : (p.address ?? ""))
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            practice_name: "",
            practice_address: [],
            lines: pdfLines.map((line) => ({
                ...line,
                treatment_date: line.treatment_date || invoiceDate,
            })),
            note: note.trim() || null,
        };
    };

    /** Draft with watermark ENTWURF: no number, nothing stored. */
    const handlePreview = async () => {
        const payload = buildPayload();
        if (!payload) return;
        setInvBusy(true);
        try {
            const bytes = await renderInvoicePdf(patientId, payload);
            openExportPreview({
                format: "pdf",
                title: t("page.administration_finance_tools.preview_title"),
                hint: "ENTWURF",
                suggestedFilename: `Rechnung-Entwurf-${invoiceDate}.pdf`,
                binaryBody: bytes,
                context: { kind: "invoice_preview", format: "pdf", entityId: patientId, documentNumber: null },
            });
        } catch (e) {
            toast(tp("page.administration_finance_tools.toast.error", { message: errorMessage(e) }), "error");
        } finally {
            setInvBusy(false);
        }
    };

    /** Final invoice: number, registry, audit. Cannot be changed afterwards. */
    const handleInvoicePdf = async () => {
        setIssueConfirmOpen(false);
        const payload = buildPayload();
        if (!payload) return;
        setInvBusy(true);
        try {
            const issued = await issueInvoice(patientId, payload, false);
            const num = issued.documentNumber ?? "";
            setInvoiceNr(num);
            openExportPreview({
                format: "pdf",
                title: t("page.administration_finance_tools.pdf_preview_title"),
                hint: tp("page.administration_finance_tools.pdf_preview_hint", { number: num, date: invoiceDate }),
                suggestedFilename: `Rechnung-${num.replace(/[^\w.-]+/g, "_")}.pdf`,
                binaryBody: pdfBase64ToBytes(issued.pdfBase64),
                context: { kind: "invoice", format: "pdf", entityId: patientId, documentNumber: num },
            });
            setInvoiceHistory(await listInvoiceDocuments(INVOICE_HISTORY_MAX));
            setSelectedHistoryId(issued.documentId);
            setCreating(false);
            toast(t("page.administration_finance_tools.toast.pdf_saved"), "success");
        } catch (e) {
            // GOZ / UStG validation errors come back as one message per line.
            toast(tp("page.administration_finance_tools.toast.error", { message: errorMessage(e) }), "error");
        } finally {
            setInvBusy(false);
        }
    };

    const handleCancelInvoice = (entry: SavedInvoice) => {
        setCancelReason("");
        setCancelTarget(entry);
    };

    const confirmCancelInvoice = async () => {
        const entry = cancelTarget;
        const reason = cancelReason.trim();
        if (!entry || !reason) return;
        setCancelTarget(null);
        setInvBusy(true);
        try {
            const storno = await cancelIssuedInvoice(entry.id, reason);
            openExportPreview({
                format: "pdf",
                title: `${t("page.administration_finance_tools.cancellation_title")} ${storno.documentNumber ?? ""}`.trim(),
                suggestedFilename: `Storno-${(storno.documentNumber ?? "").replace(/[^\w.-]+/g, "_")}.pdf`,
                binaryBody: pdfBase64ToBytes(storno.pdfBase64),
                context: { kind: "invoice_cancellation", format: "pdf", entityId: entry.patientId, documentNumber: storno.documentNumber },
            });
            setInvoiceHistory(await listInvoiceDocuments(INVOICE_HISTORY_MAX));
        } catch (e) {
            toast(tp("page.administration_finance_tools.toast.error", { message: errorMessage(e) }), "error");
        } finally {
            setInvBusy(false);
        }
    };

    const handleReminder = async (preview: boolean) => {
        const entry = reminderTarget;
        if (!entry) return;
        const fee = reminderFee.trim() ? Math.round(Number(reminderFee.replace(",", ".")) * 100) : 0;
        if (!Number.isFinite(fee) || fee < 0) {
            toast(t("page.administration_finance_tools.toast.fee_invalid"), "error");
            return;
        }
        setInvBusy(true);
        try {
            const out = await issuePaymentReminder({ invoiceDocumentId: entry.id, preview, feeCents: fee });
            openExportPreview({
                format: "pdf",
                title: `${t("page.administration_finance_tools.reminder_title")} ${out.documentNumber ?? ""}`.trim(),
                hint: preview ? "ENTWURF" : undefined,
                suggestedFilename: `Mahnung-${(out.documentNumber ?? entry.invoice.number).replace(/[^\w.-]+/g, "_")}${preview ? "-Entwurf" : ""}.pdf`,
                binaryBody: pdfBase64ToBytes(out.pdfBase64),
                context: { kind: "payment_reminder", format: "pdf", entityId: entry.patientId, documentNumber: out.documentNumber },
            });
            if (!preview) {
                setReminderTarget(null);
                setReminderFee("");
                setInvoiceHistory(await listInvoiceDocuments(INVOICE_HISTORY_MAX));
            }
        } catch (e) {
            toast(tp("page.administration_finance_tools.toast.error", { message: errorMessage(e) }), "error");
        } finally {
            setInvBusy(false);
        }
    };

    const visibleHistory = useMemo(
        () =>
            invoiceHistory.filter((h) =>
                historyFilter === "all"
                    ? true
                    : historyFilter === "overdue"
                      ? h.paymentState === "OVERDUE"
                      : h.paymentState === "OPEN" || h.paymentState === "PARTIAL" || h.paymentState === "OVERDUE",
            ),
        [invoiceHistory, historyFilter],
    );

    const stateBadge = (st: InvoicePaymentState | undefined) => {
        if (!st) return null;
        const c = STATE_STYLE[st];
        return (
            <span className="pill" style={{ fontSize: 11, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>
                {t(`page.administration_finance_tools.state.${st.toLowerCase()}`)}
            </span>
        );
    };

    const resetForm = () => {
        setPatientId("");
        setLines([newRow()]);
        setNote("");
        setInvoiceDate(todayYmd());
        setAltRecipient(false);
        setRecName("");
        setRecAddr("");
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

    /** Reprint of an issued invoice: same number, watermark "KOPIE". */
    const handleRedownloadInvoice = async (entry: SavedInvoice) => {
        setInvBusy(true);
        try {
            let bytes: Uint8Array;
            try {
                bytes = issuedPdfBytes(await reprintIssuedDocument(entry.id));
            } catch {
                // Legacy entries (before the registry) can only be shown as a draft.
                bytes = await renderInvoicePdf(entry.patientId, entry.invoice);
            }
            openExportPreview({
                format: "pdf",
                title: t("page.administration_finance_tools.export_again_title"),
                hint: tp("page.administration_finance_tools.toast.redownload_hint", { number: entry.invoice.number }),
                suggestedFilename: `Rechnung-${entry.invoice.number.replace(/[^\w.-]+/g, "_")}-Kopie.pdf`,
                binaryBody: bytes,
                context: { kind: "invoice", format: "pdf", entityId: entry.patientId, documentNumber: entry.invoice.number },
            });
        } catch (e) {
            toast(tp("page.administration_finance_tools.toast.error", { message: errorMessage(e) }), "error");
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
                {patientId ? (
                    <label className="row" style={{ gap: 8, alignItems: "center", fontSize: 13 }}>
                        <input
                            type="checkbox"
                            checked={altRecipient}
                            disabled={!canWritePayment}
                            onChange={(e) => setAltRecipient(e.target.checked)}
                        />
                        {t("page.administration_finance_tools.alt_recipient")}
                    </label>
                ) : null}
                {altRecipient ? (
                    <>
                        <Input
                            id="inv-wz-rec-name"
                            label={t("page.administration_finance_tools.alt_recipient_name")}
                            value={recName}
                            onChange={(e) => setRecName(e.target.value)}
                        />
                        <Textarea
                            id="inv-wz-rec-addr"
                            label={t("page.administration_finance_tools.alt_recipient_addr")}
                            value={recAddr}
                            onChange={(e) => setRecAddr(e.target.value)}
                        />
                    </>
                ) : null}
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
                        <Button type="button" variant="secondary" onClick={() => void handlePreview()} disabled={invBusy || !patientId}>
                            {t("page.administration_finance_tools.preview_btn")}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => (buildPayload() ? setIssueConfirmOpen(true) : undefined)}
                            disabled={invBusy || !patientId}
                            loading={invBusy}
                        >
                            {t("page.administration_finance_tools.issue_btn")}
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
                    <div className="row" style={{ gap: 8 }}>
                        <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => void handleRedownloadInvoice(selectedEntry)}
                            disabled={invBusy}
                            loading={invBusy}
                        >
                            {t("page.administration_finance_tools.export_again")}
                        </Button>
                        {canWritePayment && selectedEntry.nextReminderLevel ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => setReminderTarget(selectedEntry)}
                                disabled={invBusy}
                            >
                                {t(`page.administration_finance_tools.reminder_level.${selectedEntry.nextReminderLevel}`)}
                            </Button>
                        ) : null}
                        {canWritePayment && selectedEntry.kind === "INVOICE" && selectedEntry.status === "ISSUED" ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancelInvoice(selectedEntry)}
                                disabled={invBusy}
                            >
                                {t("page.administration_finance_tools.cancel_invoice")}
                            </Button>
                        ) : null}
                    </div>
                )}
            />
            <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <Input id="read-inv-num" label={t("page.administration_finance_tools.invoice_number")} value={selectedEntry.invoice.number} readOnly tabIndex={-1} />
                <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {stateBadge(selectedEntry.paymentState)}
                    {selectedEntry.cancelledByNumber ? (
                        <span className="page-sub" style={{ fontSize: 12 }}>
                            {tp("page.administration_finance_tools.cancelled_by", { number: selectedEntry.cancelledByNumber })}
                        </span>
                    ) : null}
                    {selectedEntry.cancelsNumber ? (
                        <span className="page-sub" style={{ fontSize: 12 }}>
                            {tp("page.administration_finance_tools.cancels", { number: selectedEntry.cancelsNumber })}
                        </span>
                    ) : null}
                    {selectedEntry.reminderLevel ? (
                        <span className="page-sub" style={{ fontSize: 12 }}>
                            {tp("page.administration_finance_tools.reminded", {
                                number: selectedEntry.lastReminderNumber ?? "",
                                date: selectedEntry.lastReminderPayBy ? formatDate(selectedEntry.lastReminderPayBy) : "",
                            })}
                        </span>
                    ) : null}
                </div>
                {selectedEntry.kind === "INVOICE" && selectedEntry.totalCents != null ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                        <Input id="read-due" label={t("page.administration_finance_tools.due_date")} value={selectedEntry.dueDate ? formatDate(selectedEntry.dueDate) : "—"} readOnly tabIndex={-1} />
                        <Input id="read-paid" label={t("page.administration_finance_tools.paid")} value={formatCurrency((selectedEntry.paidCents ?? 0) / 100)} readOnly tabIndex={-1} />
                        <Input id="read-open" label={t("page.administration_finance_tools.open")} value={formatCurrency((selectedEntry.openCents ?? 0) / 100)} readOnly tabIndex={-1} />
                    </div>
                ) : null}
                <Input id="read-inv-date" type="date" label={t("page.administration_finance_tools.invoice_date")} value={selectedEntry.invoice.date} readOnly tabIndex={-1} />
                <Input id="read-rec" label={t("common.recipient")} value={selectedEntry.invoice.recipient_name} readOnly tabIndex={-1} />
                <Textarea
                    id="read-rec-addr"
                    label={t("page.administration_finance_tools.read_addr")}
                    value={(selectedEntry.invoice.recipient_address ?? []).join("\n")}
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
                {(selectedEntry.invoice.lines ?? []).map((line, i) => (
                    <div key={i} className="card card-pad" style={{ background: "var(--surface-1)" }}>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--fg-2)", whiteSpace: "pre-wrap" }}>
                            {[line.treatment_date ? formatDate(line.treatment_date) : null, line.tooth_nr ? `Zahn ${line.tooth_nr}` : null, line.goz_nr ? `${(line.fee_schedule ?? "goz").toUpperCase()} ${line.goz_nr}` : null, line.factor != null ? `× ${String(line.factor).replace(".", ",")}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            {line.treatment_date || line.goz_nr ? "\n" : ""}
                            {line.description}
                        </p>
                        <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>
                            {formatCurrency(line.amount_cents / 100)}
                        </p>
                    </div>
                ))}
                <Input
                    id="read-sum"
                    label={t("common.sum_gross")}
                    value={formatCurrency(totalOf(selectedEntry))}
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
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, margin: "0 0 8px" }}>
                        <p className="text-title" style={{ margin: 0, fontSize: 13 }}>{t("page.administration_finance_tools.history_title")}</p>
                        <Select
                            id="inv-history-filter"
                            label=""
                            value={historyFilter}
                            onChange={(e) => setHistoryFilter(e.target.value as "all" | "open" | "overdue")}
                            options={[
                                { value: "all", label: t("page.administration_finance_tools.filter.all") },
                                { value: "open", label: t("page.administration_finance_tools.filter.open") },
                                { value: "overdue", label: t("page.administration_finance_tools.filter.overdue") },
                            ]}
                        />
                    </div>
                    {invoiceHistory.length === 0 ? (
                        <p className="page-sub" style={{ margin: 0, fontSize: 14 }}>
                            {t("page.administration_finance_tools.history_empty")}
                        </p>
                    ) : (
                        <div className="card products-table-card" style={{ overflow: "auto" }}>
                            <table className="tbl products-tbl tbl-fluid" style={{ fontSize: 14, margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th scope="col" style={{ textAlign: "start" }}>{t("page.administration_finance_tools.col.invoice")}</th>
                                        <th scope="col" style={{ textAlign: "start" }}>{t("common.date")}</th>
                                        <th scope="col" style={{ textAlign: "start" }}>{t("common.recipient")}</th>
                                        <th scope="col" style={{ textAlign: "end" }}>{t("common.sum_gross")}</th>
                                        <th scope="col" style={{ textAlign: "start" }}>{t("common.status")}</th>
                                        <th scope="col" style={{ textAlign: "start" }}>{t("page.administration_finance_tools.col.created")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleHistory.map((h) => {
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
                                                    {formatCurrency(totalOf(h))}
                                                </td>
                                                <td>{stateBadge(h.paymentState)}</td>
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
            <Dialog
                open={cancelTarget != null}
                onClose={() => setCancelTarget(null)}
                title={t("page.administration_finance_tools.cancel_invoice")}
                footer={
                    <div className="modal-actions" style={{ justifyContent: "flex-end", gap: 8 }}>
                        <Button type="button" variant="ghost" onClick={() => setCancelTarget(null)}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => void confirmCancelInvoice()}
                            disabled={!cancelReason.trim() || invBusy}
                        >
                            {t("page.administration_finance_tools.cancel_invoice_confirm")}
                        </Button>
                    </div>
                }
            >
                <div className="modal-body stack gap-3" style={{ maxWidth: 480 }}>
                    <p style={{ margin: 0, fontSize: 13 }}>
                        {t("page.administration_finance_tools.cancel_invoice_hint")}
                    </p>
                    <Textarea
                        id="cancel-invoice-reason"
                        label={t("page.administration_finance_tools.cancel_reason")}
                        rows={3}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                    />
                </div>
            </Dialog>
            <ConfirmDialog
                open={issueConfirmOpen}
                onClose={() => setIssueConfirmOpen(false)}
                onConfirm={() => void handleInvoicePdf()}
                title={t("page.administration_finance_tools.issue_confirm_title")}
                message={tp("page.administration_finance_tools.issue_confirm_message", {
                    amount: formatCurrency(amountBruttoEur),
                    recipient: altRecipient ? recName : (patients.find((x) => x.id === patientId)?.name ?? ""),
                })}
            />
            <Dialog
                open={reminderTarget != null}
                onClose={() => setReminderTarget(null)}
                title={reminderTarget?.nextReminderLevel ? t(`page.administration_finance_tools.reminder_level.${reminderTarget.nextReminderLevel}`) : ""}
                footer={
                    <div className="modal-actions" style={{ justifyContent: "flex-end", gap: 8 }}>
                        <Button type="button" variant="ghost" onClick={() => setReminderTarget(null)}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => void handleReminder(true)} disabled={invBusy}>
                            {t("page.administration_finance_tools.preview_btn")}
                        </Button>
                        <Button type="button" onClick={() => void handleReminder(false)} disabled={invBusy} loading={invBusy}>
                            {t("page.administration_finance_tools.reminder_issue")}
                        </Button>
                    </div>
                }
            >
                <div className="modal-body stack gap-3" style={{ maxWidth: 480 }}>
                    <p style={{ margin: 0, fontSize: 13 }}>
                        {reminderTarget
                            ? tp("page.administration_finance_tools.reminder_hint", {
                                  number: reminderTarget.invoice.number,
                                  open: formatCurrency((reminderTarget.openCents ?? 0) / 100),
                              })
                            : null}
                    </p>
                    {(reminderTarget?.nextReminderLevel ?? 1) >= 2 ? (
                        <Input
                            id="reminder-fee"
                            label={t("page.administration_finance_tools.reminder_fee")}
                            value={reminderFee}
                            onChange={(e) => setReminderFee(e.target.value)}
                        />
                    ) : null}
                </div>
            </Dialog>
            <PracticeReadinessDialog
                open={practiceGuardOpen}
                documentKind="invoice"
                result={checkPracticeDocumentReadiness(practice, "invoice")}
                onClose={() => setPracticeGuardOpen(false)}
            />
        </div>
    );
}
