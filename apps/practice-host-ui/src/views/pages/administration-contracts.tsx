import { useCallback, useEffect, useMemo, useState } from "react";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { FormSection } from "../components/ui/form-section";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { parseEuroInput } from "@/lib/day-close";
import { errorMessage } from "@/lib/utils";
import {
    CONTRACT_INTERVAL_OPTIONS,
    type ContractInterval,
    type ContractItem,
    formatMonthlyEquivalentText,
    formatContractTerm,
    formatContractAmountLine,
    todayYmd,
    contractActiveToday,
} from "@/lib/contract-domain";
import {
    deleteContractOnBackend,
    listContractsFromBackend,
    migrateLegacyContractsFromLocalStorageOnce,
    openContractDocument,
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

    const contractItemFromForm = (f: FormState, id: string, createdAt: string, documentPath: string | null): ContractItem => {
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
        const row = contractItemFromForm(form, selected.id, selected.createdAt, selected.documentPath);
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

    const asOfDate = useMemo(() => todayYmd(), []);

    const readField = (label: string, value: string) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{value || "—"}</span>
        </div>
    );

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
                        options={CONTRACT_INTERVAL_OPTIONS}
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
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {formBody}
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
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
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {formBody}
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
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
            const active = contractActiveToday(version);
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={version.designation}
                        subtitle={t("page.administration.contracts.detail.contract")}
                        action={(
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {readField(t("page.administration.contracts.read.partner"), version.partner)}
                        {readField(t("page.administration.contracts.read.amount_interval"), formatContractAmountLine(version.amount, version.interval))}
                        {readField(t("page.administration.contracts.read.runtime"), formatContractTerm(version))}
                        <div className="row" style={{ gap: 8, alignItems: "center" }}>
                            <span className="page-sub" style={{ fontSize: 12, margin: 0 }}>{t("page.administration.contracts.detail.status_today")}</span>
                            {active ? <Badge variant="success">{t("page.administration.contracts.badge.active")}</Badge> : <Badge variant="warning">{t("page.administration.contracts.badge.inactive")}</Badge>}
                        </div>
                        {readField(t("page.administration.contracts.detail.reference"), formatMonthlyEquivalentText(version))}
                        <FormSection title={t("page.administration.contracts.doc.section")}>
                            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                                {t("page.administration.contracts.doc.hint")}
                            </p>
                            {version.documentPath ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <span className="kpi-label-mini">{t("page.administration.contracts.doc.path_label")}</span>
                                    <span style={{ fontSize: 12, color: "var(--fg-2)", wordBreak: "break-all" }}>{version.documentPath}</span>
                                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
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
                                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
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
        return (
            <Card className="card-pad products-detail-card products-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {t("page.administration.contracts.empty_detail")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="administration-menu-page practice-workspace-page animate-fade-in">
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
                <div className="products-workspace">
                    <div className="products-workspace__list">
                        <div className="card products-table-card tbl-data-card tbl-scroll">
                            <table className="tbl products-tbl tbl-fluid">
                                <thead>
                                    <tr>
                                        <th scope="col" style={{ width: 40 }} aria-hidden> </th>
                                        <th scope="col">{t("page.administration.contracts.col.designation_partner")}</th>
                                        <th scope="col" style={{ textAlign: "end", whiteSpace: "nowrap" }}>{t("page.administration.contracts.col.amount_interval")}</th>
                                        <th scope="col">{t("page.administration.contracts.col.runtime")}</th>
                                        <th scope="col" style={{ whiteSpace: "nowrap" }}>{t("page.administration.contracts.col.status")}</th>
                                        <th scope="col" style={{ textAlign: "end", minWidth: 100 }}>{t("page.administration.contracts.col.reference")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contracts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="page-sub" style={{ padding: 20 }}>
                                                {t("page.administration.contracts.empty_table")}
                                            </td>
                                        </tr>
                                    ) : (
                                        contracts.map((version) => {
                                            const active = contractActiveToday(version);
                                            const isSel = !creating && selected?.id === version.id;
                                            return (
                                                <tr
                                                    key={version.id}
                                                    className={isSel ? "products-row--selected" : undefined}
                                                    onClick={() => selectRow(version)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <td style={{ color: "var(--fg-3)", textAlign: "center" }} title={version.documentPath ? t("page.administration.contracts.title_with_doc") : undefined}>
                                                        {version.documentPath ? "📎" : "📄"}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{version.designation}</div>
                                                        <div style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 2 }}>{version.partner}</div>
                                                    </td>
                                                    <td style={{ textAlign: "end", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                        {formatContractAmountLine(version.amount, version.interval)}
                                                    </td>
                                                    <td style={{ fontSize: 13, color: "var(--fg-2)" }}>{formatContractTerm(version)}</td>
                                                    <td>
                                                        {active ? <Badge variant="success">{t("page.administration.contracts.badge.active")}</Badge> : <Badge variant="warning">{t("page.administration.contracts.badge.outside")}</Badge>}
                                                    </td>
                                                    <td style={{ textAlign: "end", fontSize: 12, color: "var(--fg-3)" }}>
                                                        {formatMonthlyEquivalentText(version)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="products-workspace__detail">{sidePanel}</div>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
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
                                        gap: 8,
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
