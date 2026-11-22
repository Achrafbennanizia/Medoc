import { ContractsOverview } from "../components/master-detail/contracts-overview";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { Button } from "../components/ui/button";
import { DataTable, type DataTableColumn } from "../components/ui/data-table";
import { StatusBadge } from "../components/ui/status-badge";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { FormSection } from "../components/ui/form-section";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { errorMessage, formatCurrency, localIsoDate, parseEuroInput } from "@/lib/utils";
import {
    CONTRACT_INTERVAL_OPTIONS,
    type ContractInterval,
    type ContractItem,
    amountEquivalentPerMonth,
    contractCostToDate,
    contractStatus,
} from "@/lib/contract-domain";
import {
    deleteContractOnBackend,
    listContractsFromBackend,
    migrateLegacyContractsFromLocalStorageOnce,
    openContractDocument,
    setContractActive,
    upsertContractOnBackend,
} from "@/systems/practice-host/controllers/contract.controller";
import { pickContractPdfFile, openSystemScanUtility, scannerAttachContractAppData, scannerListRecent } from "@/systems/practice-host/controllers/system.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useT, useTParams } from "@/lib/i18n";
import { useAuthStore } from "@/models/store/auth-store";
import { EditIcon, BoltIcon } from "@/lib/icons";

const LS_CONTRACT_SCAN_FOLDER = "medoc-contract-scan-folder";

type TermModus = "unlimited" | "fixed_term";

const TERM_OPTIONS: { value: TermModus; labelKey: string }[] = [
    { value: "unlimited", labelKey: "page.administration.contracts.term.unlimited" },
    { value: "fixed_term", labelKey: "page.administration.contracts.term.fixed_term" },
];

type FormState = {
    designation: string;
    partner: string;
    amount: string;
    interval: ContractInterval;
    termModus: TermModus;
    periodFrom: string;
    periodUntil: string;
};

function emptyForm(): FormState {
    return {
        designation: "",
        partner: "",
        amount: "",
        interval: "MONTH",
        termModus: "unlimited",
        periodFrom: "",
        periodUntil: "",
    };
}

function formFromContract(version: ContractItem): FormState {
    return {
        designation: version.designation,
        partner: version.partner,
        amount: version.amount === 0 ? "" : String(version.amount),
        interval: version.interval,
        termModus: version.unlimited ? "unlimited" : "fixed_term",
        periodFrom: version.periodFrom ?? "",
        periodUntil: version.periodUntil ?? "",
    };
}

/**
 * Fixed-term and service contracts — like products: list left, capture & edit right (SQLite).
 */
export function AdministrationContractsPage() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canWrite = role != null && allowed("administration.contracts.write", role);

    const [contracts, setContracts] = useState<ContractItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<ContractItem | null>(null);
    const [detailEdit, setDetailEdit] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState | "periode", string>>>({});
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [scanDialogOpen, setScanDialogOpen] = useState(false);
    const [scanFolder, setScanFolder] = useState("");
    const [scanDocs, setScanDocs] = useState<{ path: string; bytes: number }[]>([]);
    const [scanBusy, setScanBusy] = useState(false);
    const [attachBusy, setAttachBusy] = useState(false);

    useEffect(() => {
        try {
            const f = localStorage.getItem(LS_CONTRACT_SCAN_FOLDER);
            if (f) setScanFolder(f);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        if (!canWrite) {
            setCreating(false);
            setDetailEdit(false);
            setDeleteId(null);
            setScanDialogOpen(false);
        }
    }, [canWrite]);

    const refreshFromBackend = useCallback(async () => {
        try {
            const rows = await listContractsFromBackend();
            setContracts(rows);
        } catch (e) {
            toast(tp("page.administration.contracts.toast.load_error", { message: errorMessage(e) }), "error");
            setContracts([]);
        }
    }, [toast, tp]);

    useEffect(() => {
        void (async () => {
            try {
                await migrateLegacyContractsFromLocalStorageOnce();
                await refreshFromBackend();
            } finally {
                setHydrated(true);
            }
        })();
    }, [refreshFromBackend]);

    const validate = (f: FormState): boolean => {
        const e: typeof formErrors = {};
        if (!f.designation.trim()) e.designation = t("page.administration.contracts.validation.designation");
        if (!f.partner.trim()) e.partner = t("page.administration.contracts.validation.partner");
        const b = f.amount.trim() === "" ? 0 : parseEuroInput(f.amount);
        if (b == null) e.amount = t("page.administration.contracts.validation.amount_invalid");
        else if (b < 0) e.amount = t("page.administration.contracts.validation.amount_negative");

        if (f.termModus === "fixed_term") {
            if (!f.periodFrom) e.periodFrom = t("page.administration.contracts.validation.period_from");
            if (!f.periodUntil) e.periodUntil = t("page.administration.contracts.validation.period_to");
            if (f.periodFrom && f.periodUntil && f.periodFrom > f.periodUntil) {
                e.periode = t("page.administration.contracts.validation.period_order");
            }
        }
        setFormErrors(e);
        return Object.keys(e).length === 0;
    };

    const openCreate = () => {
        setForm(emptyForm());
        setFormErrors({});
        setCreating(true);
        setSelected(null);
        setDetailEdit(false);
    };

    const cancelCreate = () => {
        setCreating(false);
    };

    const selectRow = (version: ContractItem) => {
        setSelected(version);
        setCreating(false);
        setDetailEdit(false);
    };

    const startEdit = () => {
        if (!selected) return;
        setForm(formFromContract(selected));
        setFormErrors({});
        setDetailEdit(true);
        setCreating(false);
    };

    const cancelEdit = () => {
        setDetailEdit(false);
        if (selected) setForm(formFromContract(selected));
    };

    const contractItemFromForm = (
        f: FormState,
        id: string,
        createdAt: string,
        documentPath: string | null,
        prev?: ContractItem,
    ): ContractItem => {
        const b = f.amount.trim() === "" ? 0 : parseEuroInput(f.amount)!;
        return {
            id,
            designation: f.designation.trim(),
            partner: f.partner.trim(),
            amount: b,
            interval: f.interval,
            unlimited: f.termModus === "unlimited",
            periodFrom: f.termModus === "fixed_term" ? f.periodFrom : null,
            periodUntil: f.termModus === "fixed_term" ? f.periodUntil : null,
            createdAt,
            documentPath,
            active: prev?.active !== false,
            deactivatedAt: prev?.active === false ? prev.deactivatedAt ?? null : null,
        };
    };

    const handleCreate = () => {
        if (!validate(form)) return;
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `version-${Date.now()}`;
        const row = contractItemFromForm(form, id, new Date().toISOString(), null);
        void (async () => {
            try {
                await upsertContractOnBackend(row);
                await refreshFromBackend();
                setCreating(false);
                setSelected(row);
                toast(t("page.administration.contracts.toast.created"), "success");
            } catch (e) {
                toast(tp("page.administration.contracts.toast.save_error", { message: errorMessage(e) }), "error");
            }
        })();
    };

    const handleUpdate = () => {
        if (!selected || !validate(form)) return;
        const row = contractItemFromForm(form, selected.id, selected.createdAt, selected.documentPath, selected);
        void (async () => {
            try {
                await upsertContractOnBackend(row);
                await refreshFromBackend();
                setSelected(row);
                setDetailEdit(false);
                toast(t("page.administration.contracts.toast.saved"), "success");
            } catch (e) {
                toast(tp("page.administration.contracts.toast.save_error", { message: errorMessage(e) }), "error");
            }
        })();
    };

    const refreshScanList = async () => {
        if (!scanFolder.trim()) {
            toast(t("page.administration.contracts.toast.scan_folder_required"), "error");
            return;
        }
        setScanBusy(true);
        try {
            const docs = await scannerListRecent(scanFolder.trim(), 20);
            setScanDocs(docs);
            try {
                localStorage.setItem(LS_CONTRACT_SCAN_FOLDER, scanFolder.trim());
            } catch {
                /* ignore */
            }
        } catch (e) {
            toast(tp("page.administration.contracts.toast.scan_error", { message: errorMessage(e) }), "error");
        } finally {
            setScanBusy(false);
        }
    };

    const attachScanToSelected = async (src: string) => {
        if (!selected || !canWrite) return;
        setAttachBusy(true);
        try {
            const dest = await scannerAttachContractAppData(src, selected.id);
            const row: ContractItem = { ...selected, documentPath: dest };
            await upsertContractOnBackend(row);
            await refreshFromBackend();
            setSelected(row);
            setScanDialogOpen(false);
            toast(t("page.administration.contracts.toast.attach_ok"), "success");
        } catch (e) {
            toast(tp("page.administration.contracts.toast.attach_error", { message: errorMessage(e) }), "error");
        } finally {
            setAttachBusy(false);
        }
    };

    const attachLocalPdfToSelected = async () => {
        if (!selected || !canWrite) return;
        let src: string | null;
        try {
            src = await pickContractPdfFile();
        } catch (e) {
            toast(tp("page.administration.contracts.toast.pick_error", { message: errorMessage(e) }), "error");
            return;
        }
        if (!src) return;
        setAttachBusy(true);
        try {
            const dest = await scannerAttachContractAppData(src, selected.id);
            const row: ContractItem = { ...selected, documentPath: dest };
            await upsertContractOnBackend(row);
            await refreshFromBackend();
            setSelected(row);
            toast(t("page.administration.contracts.toast.attach_pdf_ok"), "success");
        } catch (e) {
            toast(tp("page.administration.contracts.toast.attach_error", { message: errorMessage(e) }), "error");
        } finally {
            setAttachBusy(false);
        }
    };

    const clearContractDocument = () => {
        if (!selected || !canWrite) return;
        const row: ContractItem = { ...selected, documentPath: null };
        void (async () => {
            try {
                await upsertContractOnBackend(row);
                await refreshFromBackend();
                setSelected(row);
                toast(t("page.administration.contracts.toast.unlink_ok"), "success");
            } catch (e) {
                toast(tp("page.administration.contracts.toast.save_error", { message: errorMessage(e) }), "error");
            }
        })();
    };

    const tryOpenContractDocument = () => {
        if (!selected?.documentPath) return;
        void (async () => {
            try {
                await openContractDocument(selected.id);
            } catch (e) {
                toast(tp("page.administration.contracts.toast.open_error", { message: errorMessage(e) }), "error");
            }
        })();
    };

    const asOfDate = useMemo(() => localIsoDate(new Date()), []);

    const formatTerm = (version: ContractItem): string => {
        if (version.unlimited) return t("page.administration.contracts.fmt.unlimited");
        if (version.periodFrom && version.periodUntil) {
            return `${version.periodFrom} – ${version.periodUntil}`;
        }
        if (version.periodFrom) {
            return tp("page.administration.contracts.fmt.from", { date: version.periodFrom });
        }
        if (version.periodUntil) {
            return tp("page.administration.contracts.fmt.until", { date: version.periodUntil });
        }
        return t("common.em_dash");
    };

    const formatAmountLine = (amount: number, interval: ContractInterval): string => {
        if (amount <= 0) return t("page.administration.contracts.fmt.variable");
        return `${formatCurrency(amount)} / ${t(`page.administration.contracts.interval_short.${interval}`)}`;
    };

    const renderAmountCell = (amount: number, interval: ContractInterval) => {
        if (amount <= 0) {
            return <span className="contracts-td-amount__value">{t("page.administration.contracts.fmt.variable")}</span>;
        }
        return (
            <span className="contracts-td-amount__stack">
                <span className="contracts-td-amount__value">{formatCurrency(amount)}</span>
                <span className="contracts-td-amount__interval">
                    / {t(`page.administration.contracts.interval_short.${interval}`)}
                </span>
            </span>
        );
    };

    const renderTermCell = (version: ContractItem) => {
        if (version.unlimited) {
            return t("page.administration.contracts.fmt.unlimited");
        }
        if (version.periodFrom && version.periodUntil) {
            return (
                <span className="contracts-td-term__range">
                    <span className="contracts-td-term__date">{version.periodFrom}</span>
                    <span className="contracts-td-term__sep" aria-hidden>
                        –
                    </span>
                    <span className="contracts-td-term__date">{version.periodUntil}</span>
                </span>
            );
        }
        if (version.periodFrom) {
            return tp("page.administration.contracts.fmt.from", { date: version.periodFrom });
        }
        if (version.periodUntil) {
            return tp("page.administration.contracts.fmt.until", { date: version.periodUntil });
        }
        return t("common.em_dash");
    };

    const formatMonthlyRef = (version: ContractItem): string => {
        if (version.amount <= 0) return t("common.em_dash");
        const m = amountEquivalentPerMonth(version.amount, version.interval);
        return tp("page.administration.contracts.fmt.monthly_ref", { amount: formatCurrency(m) });
    };

    const readField = (label: string, value: string) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{value || t("common.em_dash")}</span>
        </div>
    );

    /** Activate / deactivate (status registry `contract`). Deactivation stops costs after the chosen day. */
    const [deactivateDay, setDeactivateDay] = useState(() => localIsoDate(new Date()));
    const [activationBusy, setActivationBusy] = useState(false);
    const toggleActive = async (c: ContractItem, nextActive: boolean) => {
        if (!canWrite) return;
        setActivationBusy(true);
        try {
            const updated = await setContractActive(c, nextActive, nextActive ? undefined : deactivateDay);
            setContracts((list) => list.map((x) => (x.id === updated.id ? updated : x)));
            setSelected(updated);
            toast(
                nextActive
                    ? t("page.administration.contracts.toast.activated")
                    : tp("page.administration.contracts.toast.deactivated", { date: updated.deactivatedAt ?? deactivateDay }),
                "success",
            );
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setActivationBusy(false);
        }
    };

    const contractColumns: DataTableColumn<ContractItem>[] = [
        {
            id: "name",
            header: t("page.administration.contracts.col.designation_partner"),
            truncate: true,
            text: (c) => `${c.designation} · ${c.partner}`,
            cell: (c) => (
                <div className="contracts-cell-name">
                    <span className="contracts-cell-name__icon" aria-hidden title={c.documentPath ? t("page.administration.contracts.title_with_doc") : undefined}>
                        {c.documentPath ? "📎" : "📄"}
                    </span>
                    <span className="data-table__stack">
                        <span className="data-table__primary">{c.designation}</span>
                        <span className="data-table__secondary">{c.partner}</span>
                    </span>
                </div>
            ),
        },
        {
            id: "amount",
            header: t("page.administration.contracts.col.amount_interval"),
            width: "9rem",
            numeric: true,
            cell: (c) => renderAmountCell(c.amount, c.interval),
        },
        {
            id: "term",
            header: t("page.administration.contracts.col.runtime"),
            width: "12.5rem",
            // Hidden while the table is narrow (beside the always-visible detail), so the name keeps room.
            hideBelow: "md",
            cell: (c) => renderTermCell(c),
        },
        {
            id: "status",
            header: t("page.administration.contracts.col.status"),
            width: "9.5rem",
            cell: (c) => <StatusBadge entity="contract" status={contractStatus(c)} />,
        },
        {
            id: "cost",
            header: t("page.administration.contracts.col.cost_to_date"),
            width: "9rem",
            numeric: true,
            hideBelow: "lg",
            cell: (c) => (c.amount > 0 ? formatCurrency(contractCostToDate(c)) : t("common.em_dash")),
        },
    ];

    const formBody = (
        <>
            <FormSection title={t("page.administration.contracts.section.partner")}>
                <Input
                    id="version-bez"
                    label={t("page.administration.contracts.field.designation")}
                    value={form.designation}
                    onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))}
                    error={formErrors.designation}
                    placeholder={t("page.administration.contracts.field.designation_ph")}
                />
                <Input
                    id="version-partner"
                    label={t("page.administration.contracts.field.partner")}
                    value={form.partner}
                    onChange={(e) => setForm((p) => ({ ...p, partner: e.target.value }))}
                    error={formErrors.partner}
                    placeholder={t("page.administration.contracts.field.partner_ph")}
                />
            </FormSection>
            <FormSection title={t("page.administration.contracts.section.costs")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                    <Input
                        id="version-amount"
                        label={t("page.administration.contracts.field.amount")}
                        value={form.amount}
                        onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                        error={formErrors.amount}
                        placeholder={t("page.administration.contracts.field.amount_ph")}
                    />
                    <Select
                        id="version-int"
                        label={t("page.administration.contracts.field.interval")}
                        value={form.interval}
                        onChange={(e) => setForm((p) => ({ ...p, interval: e.target.value as ContractInterval }))}
                        options={CONTRACT_INTERVAL_OPTIONS.map((o) => ({
                            value: o.value,
                            label: t(o.labelKey),
                        }))}
                    />
                </div>
                <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                    {t("page.administration.contracts.section.costs_hint")}
                </p>
            </FormSection>
            <FormSection title={t("page.administration.contracts.section.runtime")}>
                <Select
                    id="version-lauf"
                    label={t("page.administration.contracts.field.duration")}
                    value={form.termModus}
                    onChange={(e) => setForm((p) => ({ ...p, termModus: e.target.value as TermModus }))}
                    options={TERM_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                />
                {form.termModus === "fixed_term" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                        <Input
                            id="version-from"
                            type="date"
                            label={t("page.administration.contracts.field.runtime_from")}
                            value={form.periodFrom}
                            onChange={(e) => setForm((p) => ({ ...p, periodFrom: e.target.value }))}
                            error={formErrors.periodFrom}
                        />
                        <Input
                            id="version-until"
                            type="date"
                            label={t("page.administration.contracts.field.runtime_to")}
                            value={form.periodUntil}
                            onChange={(e) => setForm((p) => ({ ...p, periodUntil: e.target.value }))}
                            min={form.periodFrom || undefined}
                            error={formErrors.periodUntil}
                        />
                    </div>
                ) : (
                    <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                        {t("page.administration.contracts.term.unlimited_hint")}
                    </p>
                )}
                {formErrors.periode ? <p className="page-sub" style={{ color: "var(--red)", margin: 0, fontSize: 12 }}>{formErrors.periode}</p> : null}
            </FormSection>
            <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>{tp("page.administration.contracts.runtime_as_of_date", { date: asOfDate })}</p>
        </>
    );

    const sidePanel = (() => {
        if (creating) {
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={t("page.administration.contracts.create_title")}
                        subtitle={t("page.administration.contracts.create_subtitle")}
                        action={(
                            <Button type="button" size="sm" variant="ghost" onClick={cancelCreate}>
                                {t("common.close")}
                            </Button>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                        {formBody}
                        <div className="row" style={{ justifyContent: "flex-end", gap: "var(--space-2)", flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelCreate}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={handleCreate}>
                                {t("common.save")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected && detailEdit) {
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={t("page.administration.contracts.edit_title")}
                        subtitle={t("page.administration.contracts.edit_subtitle")}
                        action={(
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                                {t("common.cancel")}
                            </Button>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                        {formBody}
                        <div className="row" style={{ justifyContent: "flex-end", gap: "var(--space-2)", flexWrap: "wrap" }}>
                            <Button type="button" variant="ghost" onClick={cancelEdit}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={handleUpdate}>
                                {t("common.save")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected) {
            const version = selected;
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={version.designation}
                        subtitle={t("page.administration.contracts.detail.contract")}
                        action={(
                            <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {canWrite ? (
                                    <>
                                        <Button type="button" size="sm" variant="secondary" onClick={startEdit}>
                                            <EditIcon size={14} /> {t("common.edit")}
                                        </Button>
                                        <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(version.id)}>
                                            {t("common.delete")}
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                        {readField(t("page.administration.contracts.read.partner"), version.partner)}
                        {readField(t("page.administration.contracts.read.amount_interval"), formatAmountLine(version.amount, version.interval))}
                        {readField(t("page.administration.contracts.read.runtime"), formatTerm(version))}
                        <div className="contracts-status-row">
                            <span className="kpi-label-mini">{t("page.administration.contracts.detail.status_today")}</span>
                            <StatusBadge entity="contract" status={contractStatus(version)} />
                        </div>
                        <div className="contracts-cost-grid">
                            {readField(t("page.administration.contracts.detail.cost_to_date"), version.amount > 0 ? formatCurrency(contractCostToDate(version)) : t("common.em_dash"))}
                            {version.active === false && version.deactivatedAt
                                ? readField(t("page.administration.contracts.detail.deactivated_on"), version.deactivatedAt)
                                : null}
                        </div>
                        {canWrite ? (
                            <FormSection title={t("page.administration.contracts.section.activation")}>
                                {version.active === false ? (
                                    <div className="contracts-activation">
                                        <p className="page-sub contracts-activation__hint">{t("page.administration.contracts.activation.inactive_hint")}</p>
                                        <Button type="button" size="sm" disabled={activationBusy} loading={activationBusy} onClick={() => void toggleActive(version, true)}>
                                            {t("page.administration.contracts.btn.activate")}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="contracts-activation">
                                        <p className="page-sub contracts-activation__hint">{t("page.administration.contracts.activation.active_hint")}</p>
                                        <div className="contracts-activation__row">
                                            <Input
                                                type="date"
                                                label={t("page.administration.contracts.activation.deactivate_on")}
                                                value={deactivateDay}
                                                min={(!version.unlimited && version.periodFrom) || undefined}
                                                onChange={(e) => setDeactivateDay(e.target.value)}
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                disabled={activationBusy || !deactivateDay}
                                                loading={activationBusy}
                                                onClick={() => void toggleActive(version, false)}
                                            >
                                                {t("page.administration.contracts.btn.deactivate")}
                                            </Button>
                                        </div>
                                        {version.amount > 0 && deactivateDay ? (
                                            <p className="page-sub contracts-activation__hint">
                                                {tp("page.administration.contracts.activation.cost_preview", {
                                                    amount: formatCurrency(contractCostToDate({ ...version, active: false, deactivatedAt: deactivateDay }, deactivateDay)),
                                                    date: deactivateDay,
                                                })}
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </FormSection>
                        ) : null}
                        {readField(t("page.administration.contracts.detail.reference"), formatMonthlyRef(version))}
                        <FormSection title={t("page.administration.contracts.doc.section")}>
                            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                                {t("page.administration.contracts.doc.hint")}
                            </p>
                            {version.documentPath ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                                    <span className="kpi-label-mini">{t("page.administration.contracts.doc.path_label")}</span>
                                    <span style={{ fontSize: 12, color: "var(--fg-2)", wordBreak: "break-all" }}>{version.documentPath}</span>
                                    <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
                                        <Button type="button" size="sm" variant="secondary" onClick={() => void tryOpenContractDocument()}>
                                            {t("page.administration.contracts.btn.open_doc")}
                                        </Button>
                                        {canWrite ? (
                                            <Button type="button" size="sm" variant="ghost" onClick={clearContractDocument}>
                                                {t("page.administration.contracts.btn.unlink")}
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>{t("page.administration.contracts.doc.empty")}</p>
                            )}
                            {canWrite ? (
                                <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        disabled={attachBusy}
                                        onClick={() => {
                                            setScanDocs([]);
                                            setScanDialogOpen(true);
                                        }}
                                    >
                                        <BoltIcon size={14} /> {t("page.administration.contracts.btn.attach_scan")}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        disabled={attachBusy}
                                        loading={attachBusy}
                                        onClick={() => void attachLocalPdfToSelected()}
                                    >
                                        {t("page.administration.contracts.btn.pick_pdf")}
                                    </Button>
                                </div>
                            ) : null}
                        </FormSection>
                    </div>
                </Card>
            );
        }
        return <ContractsOverview contracts={contracts} onCreate={canWrite ? openCreate : undefined} />;
    })();

    return (
        <div className="administration-menu-page practice-workspace-page animate-fade-in--sticky-safe">
            <AdministrationPageHeader
                title={t("page.administration.contracts.title")}
                subtitle={t("page.administration.contracts.subtitle")}
                actions={
                    canWrite ? (
                        <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                            {creating ? t("common.cancel") : t("page.administration.contracts.btn.create")}
                        </Button>
                    ) : null
                }
            />

            {!hydrated ? (
                <p className="page-sub" style={{ margin: 0 }}>{t("page.administration.contracts.loading")}</p>
            ) : (
                <div className="staff-workspace contracts-workspace">
                    <div className="staff-workspace__list">
                        <div className="card staff-table-card contracts-table-card">
                            <DataTable
                                label={t("page.administration.contracts.title")}
                                columns={contractColumns}
                                rows={contracts}
                                getRowId={(c) => c.id}
                                selectedId={creating ? null : selected?.id ?? null}
                                onRowActivate={selectRow}
                                rowClassName={(c) => (contractStatus(c) === "INACTIVE" ? "contracts-row--inactive" : undefined)}
                                emptyLabel={t("page.administration.contracts.empty_table")}
                            />
                        </div>
                    </div>
                    <div className="staff-workspace__detail">{sidePanel}</div>
                </div>
            )}

            <Dialog
                open={scanDialogOpen}
                onClose={() => {
                    if (attachBusy) return;
                    setScanDialogOpen(false);
                }}
                title={t("page.administration.contracts.scan.dialog_title")}
                footer={(
                    <Button type="button" variant="ghost" onClick={() => setScanDialogOpen(false)} disabled={attachBusy}>
                        {t("common.close")}
                    </Button>
                )}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    <p className="page-sub" style={{ margin: 0, fontSize: 13 }}>
                        {tp("page.administration.contracts.scan.intro", { name: selected?.designation ?? "" })}
                    </p>
                    <Input
                        id="contract-scan-folder"
                        label={t("page.administration.contracts.field.scan_folder")}
                        value={scanFolder}
                        onChange={(e) => setScanFolder(e.target.value)}
                        placeholder={t("page.administration.contracts.field.scan_folder_ph")}
                    />
                    <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={scanBusy || attachBusy}
                            onClick={() => {
                                void (async () => {
                                    try {
                                        await openSystemScanUtility();
                                    } catch (e) {
                                        toast(tp("page.administration.contracts.toast.scanner_app_error", { message: errorMessage(e) }), "error");
                                    }
                                })();
                            }}
                        >
                            {t("page.administration.contracts.btn.scanner_open")}
                        </Button>
                        <Button type="button" onClick={() => void refreshScanList()} disabled={scanBusy} loading={scanBusy}>
                            {t("page.administration.contracts.btn.refresh_list")}
                        </Button>
                    </div>
                    {scanDocs.length > 0 ? (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 240, overflow: "auto" }}>
                            {scanDocs.map((d) => (
                                <li
                                    key={d.path}
                                    className="row"
                                    style={{
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "var(--space-2)",
                                        padding: "8px 0",
                                        borderBottom: "1px solid var(--line)",
                                    }}
                                >
                                    <span style={{ fontSize: 13, minWidth: 0, wordBreak: "break-all" }}>
                                        {d.path}{" "}
                                        <span style={{ color: "var(--fg-3)" }}>{tp("page.administration.contracts.scan.bytes", { bytes: d.bytes })}</span>
                                    </span>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        disabled={attachBusy}
                                        loading={attachBusy}
                                        onClick={() => void attachScanToSelected(d.path)}
                                    >
                                        {t("page.administration.contracts.scan.apply")}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>{t("page.administration.contracts.scan.empty")}</p>
                    )}
                </div>
            </Dialog>

            <ConfirmDialog
                open={Boolean(deleteId)}
                onClose={() => setDeleteId(null)}
                onConfirm={() => {
                    if (!deleteId) return;
                    const rid = deleteId;
                    void (async () => {
                        try {
                            await deleteContractOnBackend(rid);
                            await refreshFromBackend();
                            setSelected((s) => (s?.id === rid ? null : s));
                            setDeleteId(null);
                            setDetailEdit(false);
                            toast(t("page.administration.contracts.toast.deleted"), "success");
                        } catch (e) {
                            toast(tp("page.administration.contracts.toast.delete_error", { message: errorMessage(e) }), "error");
                        }
                    })();
                }}
                title={t("page.administration.contracts.confirm.delete_title")}
                message={t("page.administration.contracts.confirm.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />
        </div>
    );
}
