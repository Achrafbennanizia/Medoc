import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPayments } from "@/systems/practice-host/controllers/payment.controller";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { listProducts } from "@/systems/practice-host/controllers/product.controller";
import { createBalanceSheetSnapshot } from "@/systems/practice-host/controllers/balance-sheet-snapshot.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { Patient, Product, Payment, PaymentStatus } from "../../models/types";
import { errorMessage, formatCurrency, formatDateTime } from "@/lib/utils";
import { paymentStatusDisplay } from "@/lib/finance-order-labels";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { FormSection } from "../components/ui/form-section";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { useT, useTParams } from "@/lib/i18n";

type ContractDemo = {
    id: string;
    name: string;
    kind: string;
    cost: number;
    billing: string;
    duration_from: string;
    duration_until: string;
    status: "ACTIVE" | "TERMINATED";
};

type TFn = (key: string) => string;

function demoContracts(t: TFn): ContractDemo[] {
    return [
        { id: "demo-v1", name: t("page.balance_sheet_new.demo.contract_v1_name"), kind: t("page.balance_sheet_new.demo.contract_v1_type"), cost: 2400, billing: "Monatlich", duration_from: "2024-01-01", duration_until: "2026-12-31", status: "ACTIVE" },
        { id: "demo-v2", name: t("page.balance_sheet_new.demo.contract_v2_name"), kind: t("page.balance_sheet_new.demo.contract_v2_type"), cost: 890, billing: "Jährlich", duration_from: "2025-01-01", duration_until: "2025-12-31", status: "TERMINATED" },
        { id: "demo-v3", name: t("page.balance_sheet_new.demo.contract_v3_name"), kind: t("page.balance_sheet_new.demo.contract_v3_type"), cost: 120, billing: "Monatlich", duration_from: "2026-01-01", duration_until: "2026-12-31", status: "ACTIVE" },
    ];
}

function fallbackProducts(t: TFn): Product[] {
    return [
        { id: "demo-p1", name: t("page.balance_sheet_new.demo.product_p1_name"), description: null, category: t("page.balance_sheet_new.demo.product_p1_category"), price: 42, stock: 20, min_stock: 5, active: true, created_at: "", updated_at: "" },
        { id: "demo-p2", name: t("page.balance_sheet_new.demo.product_p2_name"), description: null, category: t("page.balance_sheet_new.demo.product_p2_category"), price: 38.5, stock: 8, min_stock: 2, active: true, created_at: "", updated_at: "" },
    ];
}

function toggleSet<T>(set: Set<T>, key: T): Set<T> {
    const n = new Set(set);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
}

export function BalanceSheetNewPage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.role);
    const canReadPatients = role ? allowed("patient.read", role) : false;
    const canBackAdministration = role != null && allowed("administration.read", role);

    const steps = useMemo(
        () => [
            t("page.balance_sheet_new.step.general"),
            t("page.balance_sheet_new.step.income"),
            t("page.balance_sheet_new.step.contracts"),
            t("page.balance_sheet_new.step.expenses"),
            t("page.balance_sheet_new.step.confirm"),
        ],
        [t],
    );

    const [step, setStep] = useState(0);
    const [ack, setAck] = useState(false);
    const [saving, setSaving] = useState(false);

    const [balanceSheetKind, setBalanceSheetKind] = useState("QUARTAL");
    const [balancePeriod, setBalancePeriod] = useState("");
    const [org, setOrg] = useState(() => t("page.balance_sheet_new.default_org"));
    const [first_name, setFirstName] = useState("");
    const [last_name, setLastName] = useState("");
    const [iban, setIban] = useState("");
    const [bic, setBic] = useState("");
    const [tax_number, setTaxNumber] = useState("");
    const [tax_office, setTaxOffice] = useState("");

    const [payments, setPayments] = useState<Payment[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [dataStatus, setDataStatus] = useState<"loading" | "ready" | "error">("loading");
    const [dataError, setDataError] = useState<string | null>(null);

    const [filterStatus, setFilterStatus] = useState<"" | PaymentStatus>("");
    const [filterMin, setFilterMin] = useState("");
    const [filterMax, setFilterMax] = useState("");
    const [filterSearch, setFilterSearch] = useState("");

    const [selPayment, setSelPayment] = useState<Set<string>>(new Set());
    const [selContract, setSelContract] = useState<Set<string>>(new Set());
    const [selExpense, setSelExpense] = useState<Set<string>>(new Set());

    const demoContracts = useMemo(() => demoContracts(t), [t]);
    const demoProducts = useMemo(() => fallbackProducts(t), [t]);

    const patientName = useMemo(() => {
        const m = new Map<string, string>();
        for (const p of patients) m.set(p.id, p.name);
        return (id: string) => m.get(id) ?? tp("break_glass.banner.patient_fallback", { id: id.slice(0, 8) });
    }, [patients, tp]);

    const expenseRows = useMemo(() => (products.length > 0 ? products : demoProducts), [products, demoProducts]);

    const reloadBase = useCallback(async () => {
        setDataError(null);
        setDataStatus("loading");
        try {
            const z = await listPayments();
            setPayments(z);
            if (canReadPatients) {
                try {
                    setPatients(await listPatients());
                } catch {
                    setPatients([]);
                }
            } else {
                setPatients([]);
            }
            try {
                setProducts(await listProducts());
            } catch {
                setProducts([]);
            }
            setDataStatus("ready");
        } catch (e) {
            setDataError(errorMessage(e));
            setDataStatus("error");
        }
    }, [canReadPatients]);

    useEffect(() => {
        void reloadBase();
    }, [reloadBase]);

    const filteredPayments = useMemo(() => {
        const min = filterMin.trim() === "" ? null : Number(filterMin.replace(",", "."));
        const max = filterMax.trim() === "" ? null : Number(filterMax.replace(",", "."));
        const q = filterSearch.trim().toLowerCase();
        return payments.filter((z) => {
            if (filterStatus && z.status !== filterStatus) return false;
            if (min != null && !Number.isNaN(min) && z.amount < min) return false;
            if (max != null && !Number.isNaN(max) && z.amount > max) return false;
            if (q) {
                const name = patientName(z.patient_id).toLowerCase();
                const desc = (z.description ?? "").toLowerCase();
                if (!name.includes(q) && !desc.includes(q) && !z.id.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [payments, filterStatus, filterMin, filterMax, filterSearch, patientName]);

    const step0Valid = balancePeriod.trim().length > 0 && iban.trim().length > 0;

    const goNext = () => {
        if (step === 0 && !step0Valid) {
            toast(t("page.balance_sheet_new.toast.validation"), "error");
            return;
        }
        setAck(false);
        setStep((s) => Math.min(steps.length - 1, s + 1));
    };

    const goBack = () => {
        setAck(false);
        setStep((s) => Math.max(0, s - 1));
    };

    if (dataStatus === "loading") return <PageLoading label={t("page.balance_sheet_new.loading")} />;
    if (dataStatus === "error" && dataError) return <PageLoadError message={dataError} onRetry={() => void reloadBase()} />;

    const selectedPaymentRows = payments.filter((z) => selPayment.has(z.id));
    const selectedContractRows = demoContracts.filter((version) => selContract.has(version.id));
    const selectedExpenseRows = expenseRows.filter((p) => selExpense.has(p.id));

    const balanceSheetKindLabel = balanceSheetKind === "YEAR" ? t("common.year") : t("common.quarter");

    return (
        <div className="practice-workspace-page animate-fade-in">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.balance_sheet_new.title")}
                back={
                    canBackAdministration
                        ? "administration"
                        : { to: "/balance-sheet", label: t("page.balance_sheet_new.back_label") }
                }
            />
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }} aria-hidden>
                {steps.map((label, i) => (
                    <span
                        key={label}
                        className="pill"
                        style={{
                            opacity: i === step ? 1 : i < step ? 0.85 : 0.45,
                            background: i === step ? "var(--accent-soft)" : undefined,
                            borderColor: i <= step ? "var(--accent)" : undefined,
                        }}
                    >
                        {i + 1}. {label}
                    </span>
                ))}
            </div>
            <Card>
                <div style={{ padding: 16 }}>
                    <CardHeader title={steps[step] ?? ""} />
                    <div style={{ marginTop: 12 }}>
                        {step === 0 ? (
                            <>
                                <FormSection title={t("page.balance_sheet_new.section.general")}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label={t("page.balance_sheet_new.field.period")} placeholder={t("page.balance_sheet_new.field.period_ph")} value={balancePeriod} onChange={(e) => setBalancePeriod(e.target.value)} />
                                        <Input label={t("common.organisation_unit")} value={org} onChange={(e) => setOrg(e.target.value)} />
                                        <Select label={t("common.type")} value={balanceSheetKind} onChange={(e) => setBalanceSheetKind(e.target.value)} options={[{ value: "QUARTAL", label: t("common.quarter") }, { value: "YEAR", label: t("common.year") }]} />
                                    </div>
                                </FormSection>
                                <FormSection title={t("page.balance_sheet_new.section.staff")}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label={t("common.first_name")} value={first_name} onChange={(e) => setFirstName(e.target.value)} />
                                        <Input label={t("common.last_name")} value={last_name} onChange={(e) => setLastName(e.target.value)} />
                                    </div>
                                </FormSection>
                                <FormSection title={t("page.balance_sheet_new.section.bank_tax")}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label={t("page.balance_sheet_new.field.iban")} value={iban} onChange={(e) => setIban(e.target.value)} />
                                        <Input label="BIC" value={bic} onChange={(e) => setBic(e.target.value)} />
                                        <Input label={t("common.tax_number")} value={tax_number} onChange={(e) => setTaxNumber(e.target.value)} />
                                        <Input label={t("common.tax_office")} value={tax_office} onChange={(e) => setTaxOffice(e.target.value)} />
                                    </div>
                                </FormSection>
                            </>
                        ) : null}

                        {step === 1 ? (
                            <FormSection title={t("page.balance_sheet_new.income.title")}>
                                <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 0 }}>
                                    {t("page.balance_sheet_new.income.hint")}
                                    {!canReadPatients ? t("page.balance_sheet_new.income.hint_no_patient_read") : null}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 12 }}>
                                    <Select
                                        label={t("common.status")}
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as "" | PaymentStatus)}
                                        options={[
                                            { value: "", label: t("common.all") },
                                            { value: "PAID", label: t("enum.payment_status.paid") },
                                            { value: "OUTSTANDING", label: t("enum.payment_status.outstanding") },
                                            { value: "PARTIALLY_PAID", label: t("enum.payment_status.partiallyPaid") },
                                            { value: "CANCELLED", label: t("enum.payment_status.cancelled") },
                                        ]}
                                    />
                                    <Input label={t("common.amount_min")} value={filterMin} onChange={(e) => setFilterMin(e.target.value)} />
                                    <Input label={t("common.amount_max")} value={filterMax} onChange={(e) => setFilterMax(e.target.value)} />
                                    <Input label={t("common.search_name_text")} value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
                                </div>
                                <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelPayment(new Set(filteredPayments.map((z) => z.id)))}>{t("common.select_all")}</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelPayment(new Set())}>{t("common.deselect_all")}</Button>
                                </div>
                                <div style={{ overflowX: "auto", maxHeight: 360, border: "1px solid var(--line)", borderRadius: 8 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead style={{ position: "sticky", top: 0, background: "var(--card)" }}>
                                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                                <th style={{ padding: 8, width: 40 }}> </th>
                                                <th style={{ padding: 8 }}>{t("common.patient_ref")}</th>
                                                <th style={{ padding: 8 }}>{t("common.amount")}</th>
                                                <th style={{ padding: 8 }}>{t("common.status")}</th>
                                                <th style={{ padding: 8 }}>{t("common.date")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPayments.map((z) => (
                                                <tr key={z.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                                    <td style={{ padding: 8 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selPayment.has(z.id)}
                                                            onChange={() => setSelPayment((s) => toggleSet(s, z.id))}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8 }}>
                                                        <div style={{ fontWeight: 600 }}>{patientName(z.patient_id)}</div>
                                                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{z.description || z.id}</div>
                                                    </td>
                                                    <td style={{ padding: 8 }}>{formatCurrency(z.amount)}</td>
                                                    <td style={{ padding: 8 }}>{paymentStatusDisplay(z.status, t).label}</td>
                                                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>{formatDateTime(z.created_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredPayments.length === 0 ? <p style={{ padding: 12, color: "var(--fg-3)" }}>{t("page.balance_sheet_new.income.no_results")}</p> : null}
                                </div>
                            </FormSection>
                        ) : null}

                        {step === 2 ? (
                            <FormSection title={t("page.balance_sheet_new.contracts.title")}>
                                <p style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("page.balance_sheet_new.contracts.hint")}</p>
                                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelContract(new Set(demoContracts.map((version) => version.id)))}>{t("common.select_all")}</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelContract(new Set())}>{t("common.deselect_all")}</Button>
                                </div>
                                <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                                <th style={{ padding: 8, width: 40 }}> </th>
                                                <th style={{ padding: 8 }}>{t("common.contract")}</th>
                                                <th style={{ padding: 8 }}>{t("common.type")}</th>
                                                <th style={{ padding: 8 }}>{t("page.balance_sheet_new.col.cost")}</th>
                                                <th style={{ padding: 8 }}>{t("common.status")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {demoContracts.map((version) => (
                                                <tr key={version.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                                    <td style={{ padding: 8 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selContract.has(version.id)}
                                                            onChange={() => setSelContract((s) => toggleSet(s, version.id))}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8 }}>{version.name}</td>
                                                    <td style={{ padding: 8 }}>{version.kind}</td>
                                                    <td style={{ padding: 8 }}>{formatCurrency(version.cost)}</td>
                                                    <td style={{ padding: 8 }}>
                                                        <span className="pill" style={{ fontSize: 11, borderColor: version.status === "ACTIVE" ? "var(--accent)" : "var(--red)" }}>
                                                            {version.status === "ACTIVE" ? t("common.active") : t("common.terminated")}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </FormSection>
                        ) : null}

                        {step === 3 ? (
                            <FormSection title={t("page.balance_sheet_new.expenses.title")}>
                                <p style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("page.balance_sheet_new.expenses.hint")}</p>
                                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelExpense(new Set(expenseRows.map((p) => p.id)))}>{t("common.select_all")}</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelExpense(new Set())}>{t("common.deselect_all")}</Button>
                                </div>
                                <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                                <th style={{ padding: 8, width: 40 }}> </th>
                                                <th style={{ padding: 8 }}>{t("common.product")}</th>
                                                <th style={{ padding: 8 }}>{t("common.category")}</th>
                                                <th style={{ padding: 8 }}>{t("common.price")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {expenseRows.map((p) => (
                                                <tr key={p.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                                    <td style={{ padding: 8 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selExpense.has(p.id)}
                                                            onChange={() => setSelExpense((s) => toggleSet(s, p.id))}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8 }}>{p.name}</td>
                                                    <td style={{ padding: 8 }}>{p.category}</td>
                                                    <td style={{ padding: 8 }}>{formatCurrency(p.price)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </FormSection>
                        ) : null}

                        {step === 4 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                                    {t("page.balance_sheet_new.confirm.summary")}
                                </p>
                                <FormSection title={t("page.balance_sheet_new.section.master_data")}>
                                    <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 14, color: "var(--fg-2)" }}>
                                        <li>{tp("page.balance_sheet_new.summary.period", { period: balancePeriod || "—" })}</li>
                                        <li>{tp("page.balance_sheet_new.summary.org", { org })}</li>
                                        <li>{tp("page.balance_sheet_new.summary.type", { type: balanceSheetKindLabel })}</li>
                                        <li>{tp("page.balance_sheet_new.summary.name", { first: first_name, last: last_name })}</li>
                                        <li>{tp("page.balance_sheet_new.summary.iban", { iban: iban || "—", bic: bic || "—" })}</li>
                                        <li>{tp("page.balance_sheet_new.summary.tax", { tax: tax_number || "—", office: tax_office || "—" })}</li>
                                    </ul>
                                </FormSection>
                                <FormSection title={t("page.balance_sheet_new.section.selection")}>
                                    <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 14, color: "var(--fg-2)" }}>
                                        <li>{tp("page.balance_sheet_new.summary.income_count", { count: selectedPaymentRows.length })}</li>
                                        <li>{tp("page.balance_sheet_new.summary.contracts_count", { count: selectedContractRows.length })}</li>
                                        <li>{tp("page.balance_sheet_new.summary.expenses_count", { count: selectedExpenseRows.length })}</li>
                                    </ul>
                                </FormSection>
                                {selectedPaymentRows.length > 0 ? (
                                    <FormSection title={t("page.balance_sheet_new.section.selected_payments")}>
                                        <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
                                            {selectedPaymentRows.slice(0, 12).map((z) => (
                                                <div key={z.id} className="row" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px dashed var(--line)" }}>
                                                    <span>{patientName(z.patient_id)}</span>
                                                    <span>{formatCurrency(z.amount)} · {paymentStatusDisplay(z.status, t).label}</span>
                                                </div>
                                            ))}
                                            {selectedPaymentRows.length > 12 ? <p style={{ fontSize: 12, color: "var(--fg-3)" }}>{tp("common.and_more", { count: selectedPaymentRows.length - 12 })}</p> : null}
                                        </div>
                                    </FormSection>
                                ) : null}
                            </div>
                        ) : null}

                        <label className="row" style={{ gap: 10, marginTop: 18, alignItems: "flex-start", cursor: "pointer" }}>
                            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                            <span style={{ fontSize: 13 }}>{t("common.step_ack")}</span>
                        </label>
                    </div>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                        <Button type="button" variant="danger" onClick={() => navigate("/balance-sheet")}>{t("common.cancel")}</Button>
                        {step > 0 ? <Button type="button" variant="ghost" onClick={goBack}>{t("common.back")}</Button> : null}
                        {step < steps.length - 1 ? (
                            <Button type="button" disabled={!ack} onClick={goNext}>{t("common.continue")}</Button>
                        ) : (
                            <Button
                                type="button"
                                disabled={!ack || saving}
                                loading={saving}
                                onClick={async () => {
                                    setSaving(true);
                                    try {
                                        const incomeCents = Math.round(
                                            selectedPaymentRows.reduce((s, z) => s + z.amount, 0) * 100,
                                        );
                                        const expensesCents = Math.round(
                                            (selectedExpenseRows.reduce((s, p) => s + p.price, 0)
                                                + selectedContractRows.reduce((s, version) => s + version.cost, 0)) * 100,
                                        );
                                        const label = `${balanceSheetKind} ${balancePeriod}`.trim();
                                        await createBalanceSheetSnapshot({
                                            period: balancePeriod,
                                            kind: balanceSheetKind,
                                            label: label || tp("page.balance_sheet_new.label_fallback", { date: new Date().toISOString().slice(0, 10) }),
                                            income_cents: incomeCents,
                                            expenses_cents: expensesCents,
                                            payload: {
                                                master_data: { org, first_name, last_name, iban, bic, tax_number, tax_office },
                                                income: selectedPaymentRows.map((z) => ({
                                                    id: z.id, amount: z.amount, status: z.status,
                                                    patient_id: z.patient_id, description: z.description,
                                                })),
                                                contracts: selectedContractRows,
                                                expenses: selectedExpenseRows.map((p) => ({
                                                    id: p.id, name: p.name, category: p.category, price: p.price,
                                                })),
                                            },
                                        });
                                        toast(t("page.balance_sheet_new.toast.saved"), "success");
                                        navigate("/balance-sheet");
                                    } catch (e) {
                                        toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                {t("common.finish")}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
