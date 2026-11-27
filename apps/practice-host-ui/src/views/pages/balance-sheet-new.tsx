import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    computePeriodReport,
    createPeriodReport,
    periodBounds,
    type PeriodKind,
    type PeriodReport,
} from "@/systems/practice-host/controllers/balance-sheet-snapshot.controller";
import { issuedPdfBytes } from "@/systems/practice-host/controllers/document.controller";
import { openExportPreview } from "@/models/store/export-preview-store";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import { errorMessage, formatCurrency, formatDate, localIsoDate } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { FormSection } from "../components/ui/form-section";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { useT, useTParams } from "@/lib/i18n";

const eur = (cents: number) => formatCurrency(cents / 100);

const METHOD_KEYS: Record<string, string> = {
    CASH: "page.day_close.method.cash",
    CARD: "page.day_close.method.card",
    BANK_TRANSFER: "page.day_close.method.bank_transfer",
    INVOICE: "page.day_close.method.invoice",
    Bar: "page.day_close.method.cash",
    Karte: "page.day_close.method.card",
    Überweisung: "page.day_close.method.bank_transfer",
    Rechnung: "page.day_close.method.invoice",
};

function methodName(t: (key: string) => string, code: string): string {
    const key = METHOD_KEYS[code];
    return key ? t(key) : code;
}

function expenseLabel(
    tp: (key: string, params: Record<string, string | number>) => string,
    label: string,
    voucher?: string | null,
): string {
    const no = voucher?.trim();
    if (!no) return label;
    return `${label} (${tp("page.balance_sheet_new.voucher", { no })})`;
}

function previousPeriod(kind: Exclude<PeriodKind, "CUSTOM">): { from: string; to: string } {
    const now = new Date();
    if (kind === "YEAR") return periodBounds("YEAR", new Date(now.getFullYear() - 1, 0, 1));
    if (kind === "QUARTER") return periodBounds("QUARTER", new Date(now.getFullYear(), now.getMonth() - 3, 1));
    return periodBounds("MONTH", new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

/**
 * Period report (Einnahmen-Überschuss-Übersicht). Replaces the old balance
 * wizard: every figure is computed on the server from money actually
 * received, the cash book, delivered orders and contracts. Nothing is ticked
 * by hand, and the saved report is a numbered, unchangeable document.
 */
export function BalanceSheetNewPage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canWrite = role != null && allowed("finance.write", role);
    const canBackAdministration = role != null && allowed("administration.read", role);

    const [kind, setKind] = useState<PeriodKind>("MONTH");
    const initial = previousPeriod("MONTH");
    const [from, setFrom] = useState(initial.from);
    const [to, setTo] = useState(initial.to);
    const [label, setLabel] = useState("");
    const [report, setReport] = useState<PeriodReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const onKind = (k: PeriodKind) => {
        setKind(k);
        if (k !== "CUSTOM") {
            const p = previousPeriod(k);
            setFrom(p.from);
            setTo(p.to);
        }
    };

    const load = useCallback(async () => {
        setError(null);
        try {
            setReport(await computePeriodReport(from, to, kind));
        } catch (e) {
            setReport(null);
            setError(errorMessage(e));
        }
    }, [from, to, kind]);

    useEffect(() => {
        void load();
    }, [load]);

    const today = useMemo(() => localIsoDate(new Date()), []);
    const finished = to < today;

    const openPdf = async (preview: boolean) => {
        setBusy(true);
        try {
            const res = await createPeriodReport({ from, to, kind, label: label.trim() || undefined, preview });
            openExportPreview({
                format: "pdf",
                title: `${t("page.balance_sheet_new.title")} ${res.pdf.documentNumber ?? ""}`.trim(),
                hint: preview ? t("page.balance_sheet_new.pdf_hint_draft") : undefined,
                suggestedFilename: `${t("page.balance_sheet_new.pdf_filename")}-${from}-${to}${preview ? `-${t("page.balance_sheet_new.pdf_file_draft")}` : ""}.pdf`,
                binaryBody: issuedPdfBytes(res.pdf),
                context: { kind: "period_report", format: "pdf", entityId: res.snapshotId, documentNumber: res.pdf.documentNumber },
            });
            if (!preview) {
                toast(tp("page.balance_sheet_new.toast.saved_number", { number: res.pdf.documentNumber ?? "" }), "success");
                navigate("/balance-sheet");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const line = (labelText: string, cents: number, strong = false) => (
        <div className="row" style={{ justifyContent: "space-between", gap: "var(--space-3)", fontSize: 14 }}>
            <span style={{ color: "var(--fg-2)" }}>{labelText}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: strong ? 700 : 500 }}>{eur(cents)}</span>
        </div>
    );

    return (
        <div className="practice-workspace-page animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.balance_sheet_new.title")}
                back={canBackAdministration ? "administration" : { to: "/balance-sheet", label: t("page.balance_sheet_new.back_label") }}
            />
            <Card>
                <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    <FormSection title={t("page.balance_sheet_new.section.period")}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Select
                                id="pr-kind"
                                label={t("common.type")}
                                value={kind}
                                onChange={(e) => onKind(e.target.value as PeriodKind)}
                                options={[
                                    { value: "MONTH", label: t("page.balance_sheet_new.kind.month") },
                                    { value: "QUARTER", label: t("common.quarter") },
                                    { value: "YEAR", label: t("common.year") },
                                    { value: "CUSTOM", label: t("page.balance_sheet_new.kind.custom") },
                                ]}
                            />
                            <Input id="pr-from" type="date" label={t("page.balance_sheet_new.field.from")} value={from} disabled={kind !== "CUSTOM"} onChange={(e) => setFrom(e.target.value)} />
                            <Input id="pr-to" type="date" label={t("page.balance_sheet_new.field.to")} value={to} disabled={kind !== "CUSTOM"} onChange={(e) => setTo(e.target.value)} />
                            <Input id="pr-label" label={t("page.balance_sheet_new.field.label")} value={label} onChange={(e) => setLabel(e.target.value)} />
                        </div>
                    </FormSection>

                    {error ? <PageLoadError message={error} onRetry={() => void load()} /> : null}

                    {report ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="card-pad">
                                    <CardHeader title={t("page.balance_sheet_new.result_title")} />
                                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                                        {line(t("page.balance_sheet_new.income"), report.incomeCents)}
                                        {line(t("page.balance_sheet_new.expenses"), report.expensesCents)}
                                        {line(t("page.balance_sheet_new.result"), report.resultCents, true)}
                                        {report.expensesEstimateCents > 0
                                            ? line(t("page.balance_sheet_new.expenses_estimate"), report.expensesEstimateCents)
                                            : null}
                                    </div>
                                </Card>
                                <Card className="card-pad">
                                    <CardHeader title={t("page.balance_sheet_new.info_title")} />
                                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                                        {line(tp("page.balance_sheet_new.invoiced", { count: report.invoiceCount }), report.invoicedCents)}
                                        {line(tp("page.balance_sheet_new.cancellations", { count: report.cancellationCount }), report.cancellationCents)}
                                        {line(
                                            tp("page.balance_sheet_new.open_receivables", { count: report.openReceivablesCount, date: formatDate(report.to) }),
                                            report.openReceivablesCents,
                                        )}
                                    </div>
                                </Card>
                            </div>

                            {report.unclosedDays.length > 0 ? (
                                <p className="card card-pad" role="status" style={{ margin: 0, fontSize: 13 }}>
                                    {tp("page.balance_sheet_new.unclosed_days", { days: report.unclosedDays.map((d) => formatDate(d)).join(", ") })}
                                </p>
                            ) : null}
                            {report.voidNumbers?.length ? (
                                <p className="card card-pad" role="status" style={{ margin: 0, fontSize: 13 }}>
                                    {tp("page.balance_sheet_new.void_numbers", {
                                        ranges: report.voidNumbers.map((v) => `${v.first} – ${v.last} (${v.count})`).join(", "),
                                    })}
                                </p>
                            ) : null}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="card-pad">
                                    <CardHeader title={t("page.balance_sheet_new.income_by_method")} />
                                    {report.incomeByMethod.length === 0 ? (
                                        <p className="page-sub" style={{ margin: 0 }}>{t("page.balance_sheet_new.none")}</p>
                                    ) : (
                                        report.incomeByMethod.map((a) => <div key={a.label}>{line(methodName(t, a.label), a.cents)}</div>)
                                    )}
                                </Card>
                                <Card className="card-pad">
                                    <CardHeader title={t("page.balance_sheet_new.expenses_title")} />
                                    {report.expenses.length === 0 ? (
                                        <p className="page-sub" style={{ margin: 0 }}>{t("page.balance_sheet_new.none")}</p>
                                    ) : (
                                        <div style={{ maxHeight: 260, overflow: "auto", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                                            {report.expenses.map((e, i) => (
                                                <div key={i}>
                                                    {line(
                                                        `${t(`page.balance_sheet_new.source.${e.source.toLowerCase()}`)} · ${expenseLabel(tp, e.label, e.voucher)}${e.estimate ? " *" : ""}`,
                                                        e.cents,
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="page-sub" style={{ margin: "8px 0 0", fontSize: 12 }}>{t("page.balance_sheet_new.estimate_note")}</p>
                                </Card>
                            </div>
                            <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>{t("page.balance_sheet_new.disclaimer")}</p>
                        </>
                    ) : null}

                    <div className="row" style={{ justifyContent: "flex-end", gap: "var(--space-2)", flexWrap: "wrap" }}>
                        <Button type="button" variant="secondary" onClick={() => void openPdf(true)} disabled={busy || !report}>
                            {t("page.balance_sheet_new.preview_btn")}
                        </Button>
                        {canWrite ? (
                            <Button type="button" onClick={() => setConfirmOpen(true)} disabled={busy || !report || !finished} loading={busy}>
                                {t("page.balance_sheet_new.save_btn")}
                            </Button>
                        ) : null}
                    </div>
                    {!finished ? (
                        <p className="page-sub" style={{ margin: 0, fontSize: 12, textAlign: "end" }}>{t("page.balance_sheet_new.not_finished")}</p>
                    ) : null}
                </div>
            </Card>
            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => {
                    setConfirmOpen(false);
                    void openPdf(false);
                }}
                title={t("page.balance_sheet_new.confirm_title")}
                message={tp("page.balance_sheet_new.confirm_message", { from: formatDate(from), to: formatDate(to) })}
            />
        </div>
    );
}
