import { useCallback, useEffect, useMemo, useState } from "react";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { FormSection } from "../components/ui/form-section";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { parseEuroInput } from "@/lib/tagesabschluss";
import { errorMessage } from "@/lib/utils";
import {
    VERTRAG_INTERVALL_OPTIONS,
    type VertragIntervall,
    type VertragItem,
    formatMonatsaequivalenzText,
    formatVertragLaufzeit,
    formatVertragbetragzeile,
    heuteYmd,
    vertragAktivHeute,
} from "@/lib/vertrag-domain";
import {
    deleteVertragOnBackend,
    listVertraegeFromBackend,
    migrateLegacyVertraegeFromLocalStorageOnce,
    openVertragDokument,
    upsertVertragOnBackend,
} from "@/systems/practice-host/controllers/vertrag.controller";
import { pickVertragPdfFile, openSystemScanUtility, scannerAttachVertragAppData, scannerListRecent } from "@/systems/practice-host/controllers/system.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useT, useTParams } from "@/lib/i18n";
import { useAuthStore } from "@/models/store/auth-store";
import { EditIcon, BoltIcon } from "@/lib/icons";

const LS_VERTRAG_SCAN_FOLDER = "medoc-vertrag-scan-folder";

type LaufzeitModus = "unbefristet" | "befristet";

const LAUFZEIT_OPTIONS: { value: LaufzeitModus; labelKey: string }[] = [
    { value: "unbefristet", labelKey: "page.verwaltung.vertraege.laufzeit.unbefristet" },
    { value: "befristet", labelKey: "page.verwaltung.vertraege.laufzeit.befristet" },
];

type FormState = {
    bezeichnung: string;
    partner: string;
    betrag: string;
    intervall: VertragIntervall;
    laufzeitModus: LaufzeitModus;
    periodeVon: string;
    periodeBis: string;
};

function emptyForm(): FormState {
    return {
        bezeichnung: "",
        partner: "",
        betrag: "",
        intervall: "MONAT",
        laufzeitModus: "unbefristet",
        periodeVon: "",
        periodeBis: "",
    };
}

function formFromVertrag(v: VertragItem): FormState {
    return {
        bezeichnung: v.bezeichnung,
        partner: v.partner,
        betrag: v.betrag === 0 ? "" : String(v.betrag),
        intervall: v.intervall,
        laufzeitModus: v.unbefristet ? "unbefristet" : "befristet",
        periodeVon: v.periodeVon ?? "",
        periodeBis: v.periodeBis ?? "",
    };
}

/**
 * Fixed-term and service contracts — like products: list left, capture & edit right (SQLite).
 */
export function VerwaltungVertraegePage() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canWrite = role != null && allowed("verwaltung.vertraege.write", role);

    const [vertraege, setVertraege] = useState<VertragItem[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<VertragItem | null>(null);
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
            const f = localStorage.getItem(LS_VERTRAG_SCAN_FOLDER);
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
            const rows = await listVertraegeFromBackend();
            setVertraege(rows);
        } catch (e) {
            toast(tp("page.verwaltung.vertraege.toast.load_error", { message: errorMessage(e) }), "error");
            setVertraege([]);
        }
    }, [toast, tp]);

    useEffect(() => {
        void (async () => {
            try {
                await migrateLegacyVertraegeFromLocalStorageOnce();
                await refreshFromBackend();
            } finally {
                setHydrated(true);
            }
        })();
    }, [refreshFromBackend]);

    const validate = (f: FormState): boolean => {
        const e: typeof formErrors = {};
        if (!f.bezeichnung.trim()) e.bezeichnung = t("page.verwaltung.vertraege.validation.designation");
        if (!f.partner.trim()) e.partner = t("page.verwaltung.vertraege.validation.partner");
        const b = f.betrag.trim() === "" ? 0 : parseEuroInput(f.betrag);
        if (b == null) e.betrag = t("page.verwaltung.vertraege.validation.amount_invalid");
        else if (b < 0) e.betrag = t("page.verwaltung.vertraege.validation.amount_negative");

        if (f.laufzeitModus === "befristet") {
            if (!f.periodeVon) e.periodeVon = t("page.verwaltung.vertraege.validation.period_from");
            if (!f.periodeBis) e.periodeBis = t("page.verwaltung.vertraege.validation.period_to");
            if (f.periodeVon && f.periodeBis && f.periodeVon > f.periodeBis) {
                e.periode = t("page.verwaltung.vertraege.validation.period_order");
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

    const selectRow = (v: VertragItem) => {
        setSelected(v);
        setCreating(false);
        setDetailEdit(false);
    };

    const startEdit = () => {
        if (!selected) return;
        setForm(formFromVertrag(selected));
        setFormErrors({});
        setDetailEdit(true);
        setCreating(false);
    };

    const cancelEdit = () => {
        setDetailEdit(false);
        if (selected) setForm(formFromVertrag(selected));
    };

    const vertragItemFromForm = (f: FormState, id: string, createdAt: string, dokumentPfad: string | null): VertragItem => {
        const b = f.betrag.trim() === "" ? 0 : parseEuroInput(f.betrag)!;
        return {
            id,
            bezeichnung: f.bezeichnung.trim(),
            partner: f.partner.trim(),
            betrag: b,
            intervall: f.intervall,
            unbefristet: f.laufzeitModus === "unbefristet",
            periodeVon: f.laufzeitModus === "befristet" ? f.periodeVon : null,
            periodeBis: f.laufzeitModus === "befristet" ? f.periodeBis : null,
            createdAt,
            dokumentPfad,
        };
    };

    const handleCreate = () => {
        if (!validate(form)) return;
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}`;
        const row = vertragItemFromForm(form, id, new Date().toISOString(), null);
        void (async () => {
            try {
                await upsertVertragOnBackend(row);
                await refreshFromBackend();
                setCreating(false);
                setSelected(row);
                toast(t("page.verwaltung.vertraege.toast.created"), "success");
            } catch (e) {
                toast(tp("page.verwaltung.vertraege.toast.save_error", { message: errorMessage(e) }), "error");
            }
        })();
    };

    const handleUpdate = () => {
        if (!selected || !validate(form)) return;
        const row = vertragItemFromForm(form, selected.id, selected.createdAt, selected.dokumentPfad);
        void (async () => {
            try {
                await upsertVertragOnBackend(row);
                await refreshFromBackend();
                setSelected(row);
                setDetailEdit(false);
                toast(t("page.verwaltung.vertraege.toast.saved"), "success");
            } catch (e) {
                toast(tp("page.verwaltung.vertraege.toast.save_error", { message: errorMessage(e) }), "error");
            }
        })();
    };

    const refreshScanList = async () => {
        if (!scanFolder.trim()) {
            toast(t("page.verwaltung.vertraege.toast.scan_folder_required"), "error");
            return;
        }
        setScanBusy(true);
        try {
            const docs = await scannerListRecent(scanFolder.trim(), 20);
            setScanDocs(docs);
            try {
                localStorage.setItem(LS_VERTRAG_SCAN_FOLDER, scanFolder.trim());
            } catch {
                /* ignore */
            }
        } catch (e) {
            toast(tp("page.verwaltung.vertraege.toast.scan_error", { message: errorMessage(e) }), "error");
        } finally {
            setScanBusy(false);
        }
    };

    const attachScanToSelected = async (src: string) => {
        if (!selected || !canWrite) return;
        setAttachBusy(true);
        try {
            const dest = await scannerAttachVertragAppData(src, selected.id);
            const row: VertragItem = { ...selected, dokumentPfad: dest };
            await upsertVertragOnBackend(row);
            await refreshFromBackend();
            setSelected(row);
            setScanDialogOpen(false);
            toast(t("page.verwaltung.vertraege.toast.attach_ok"), "success");
        } catch (e) {
            toast(tp("page.verwaltung.vertraege.toast.attach_error", { message: errorMessage(e) }), "error");
        } finally {
            setAttachBusy(false);
        }
    };

    const attachLocalPdfToSelected = async () => {
        if (!selected || !canWrite) return;
        let src: string | null;
        try {
            src = await pickVertragPdfFile();
        } catch (e) {
            toast(tp("page.verwaltung.vertraege.toast.pick_error", { message: errorMessage(e) }), "error");
            return;
        }
        if (!src) return;
        setAttachBusy(true);
        try {
            const dest = await scannerAttachVertragAppData(src, selected.id);
            const row: VertragItem = { ...selected, dokumentPfad: dest };
            await upsertVertragOnBackend(row);
            await refreshFromBackend();
            setSelected(row);
            toast(t("page.verwaltung.vertraege.toast.attach_pdf_ok"), "success");
        } catch (e) {
            toast(tp("page.verwaltung.vertraege.toast.attach_error", { message: errorMessage(e) }), "error");
        } finally {
            setAttachBusy(false);
        }
    };

    const clearVertragDokument = () => {
        if (!selected || !canWrite) return;
        const row: VertragItem = { ...selected, dokumentPfad: null };
        void (async () => {
            try {
                await upsertVertragOnBackend(row);
                await refreshFromBackend();
                setSelected(row);
                toast(t("page.verwaltung.vertraege.toast.unlink_ok"), "success");
            } catch (e) {
                toast(tp("page.verwaltung.vertraege.toast.save_error", { message: errorMessage(e) }), "error");
            }
        })();
    };

    const tryOpenVertragDokument = () => {
        if (!selected?.dokumentPfad) return;
        void (async () => {
            try {
                await openVertragDokument(selected.id);
            } catch (e) {
                toast(tp("page.verwaltung.vertraege.toast.open_error", { message: errorMessage(e) }), "error");
            }
        })();
    };

    const heute = useMemo(() => heuteYmd(), []);

    const readField = (label: string, value: string) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{value || "—"}</span>
        </div>
    );

    const formBody = (
        <>
            <FormSection title={t("page.verwaltung.vertraege.section.partner")}>
                <Input
                    id="v-bez"
                    label={t("page.verwaltung.vertraege.field.designation")}
                    value={form.bezeichnung}
                    onChange={(e) => setForm((p) => ({ ...p, bezeichnung: e.target.value }))}
                    error={formErrors.bezeichnung}
                    placeholder={t("page.verwaltung.vertraege.field.designation_ph")}
                />
                <Input
                    id="v-partner"
                    label={t("page.verwaltung.vertraege.field.partner")}
                    value={form.partner}
                    onChange={(e) => setForm((p) => ({ ...p, partner: e.target.value }))}
                    error={formErrors.partner}
                    placeholder={t("page.verwaltung.vertraege.field.partner_ph")}
                />
            </FormSection>
            <FormSection title={t("page.verwaltung.vertraege.section.costs")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                    <Input
                        id="v-betrag"
                        label={t("page.verwaltung.vertraege.field.amount")}
                        value={form.betrag}
                        onChange={(e) => setForm((p) => ({ ...p, betrag: e.target.value }))}
                        error={formErrors.betrag}
                        placeholder={t("page.verwaltung.vertraege.field.amount_ph")}
                    />
                    <Select
                        id="v-int"
                        label={t("page.verwaltung.vertraege.field.interval")}
                        value={form.intervall}
                        onChange={(e) => setForm((p) => ({ ...p, intervall: e.target.value as VertragIntervall }))}
                        options={VERTRAG_INTERVALL_OPTIONS}
                    />
                </div>
                <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                    {t("page.verwaltung.vertraege.section.costs_hint")}
                </p>
            </FormSection>
            <FormSection title={t("page.verwaltung.vertraege.section.runtime")}>
                <Select
                    id="v-lauf"
                    label={t("page.verwaltung.vertraege.field.duration")}
                    value={form.laufzeitModus}
                    onChange={(e) => setForm((p) => ({ ...p, laufzeitModus: e.target.value as LaufzeitModus }))}
                    options={LAUFZEIT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                />
                {form.laufzeitModus === "befristet" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ alignItems: "flex-start" }}>
                        <Input
                            id="v-von"
                            type="date"
                            label={t("page.verwaltung.vertraege.field.runtime_from")}
                            value={form.periodeVon}
                            onChange={(e) => setForm((p) => ({ ...p, periodeVon: e.target.value }))}
                            error={formErrors.periodeVon}
                        />
                        <Input
                            id="v-bis"
                            type="date"
                            label={t("page.verwaltung.vertraege.field.runtime_to")}
                            value={form.periodeBis}
                            onChange={(e) => setForm((p) => ({ ...p, periodeBis: e.target.value }))}
                            min={form.periodeVon || undefined}
                            error={formErrors.periodeBis}
                        />
                    </div>
                ) : (
                    <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                        {t("page.verwaltung.vertraege.laufzeit.unbefristet_hint")}
                    </p>
                )}
                {formErrors.periode ? <p className="page-sub" style={{ color: "var(--red)", margin: 0, fontSize: 12 }}>{formErrors.periode}</p> : null}
            </FormSection>
            <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>{tp("page.verwaltung.vertraege.runtime_stichtag", { date: heute })}</p>
        </>
    );

    const sidePanel = (() => {
        if (creating) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={t("page.verwaltung.vertraege.create_title")}
                        subtitle={t("page.verwaltung.vertraege.create_subtitle")}
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
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={t("page.verwaltung.vertraege.edit_title")}
                        subtitle={t("page.verwaltung.vertraege.edit_subtitle")}
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
            const v = selected;
            const aktiv = vertragAktivHeute(v);
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={v.bezeichnung}
                        subtitle={t("page.verwaltung.vertraege.detail.contract")}
                        action={(
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {canWrite ? (
                                    <>
                                        <Button type="button" size="sm" variant="secondary" onClick={startEdit}>
                                            <EditIcon size={14} /> {t("common.edit")}
                                        </Button>
                                        <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(v.id)}>
                                            {t("common.delete")}
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {readField(t("page.verwaltung.vertraege.read.partner"), v.partner)}
                        {readField(t("page.verwaltung.vertraege.read.amount_interval"), formatVertragbetragzeile(v.betrag, v.intervall))}
                        {readField(t("page.verwaltung.vertraege.read.runtime"), formatVertragLaufzeit(v))}
                        <div className="row" style={{ gap: 8, alignItems: "center" }}>
                            <span className="page-sub" style={{ fontSize: 12, margin: 0 }}>{t("page.verwaltung.vertraege.detail.status_today")}</span>
                            {aktiv ? <Badge variant="success">{t("page.verwaltung.vertraege.badge.active")}</Badge> : <Badge variant="warning">{t("page.verwaltung.vertraege.badge.inactive")}</Badge>}
                        </div>
                        {readField(t("page.verwaltung.vertraege.detail.reference"), formatMonatsaequivalenzText(v))}
                        <FormSection title={t("page.verwaltung.vertraege.doc.section")}>
                            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                                {t("page.verwaltung.vertraege.doc.hint")}
                            </p>
                            {v.dokumentPfad ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <span className="kpi-label-mini">{t("page.verwaltung.vertraege.doc.path_label")}</span>
                                    <span style={{ fontSize: 12, color: "var(--fg-2)", wordBreak: "break-all" }}>{v.dokumentPfad}</span>
                                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                        <Button type="button" size="sm" variant="secondary" onClick={() => void tryOpenVertragDokument()}>
                                            {t("page.verwaltung.vertraege.btn.open_doc")}
                                        </Button>
                                        {canWrite ? (
                                            <Button type="button" size="sm" variant="ghost" onClick={clearVertragDokument}>
                                                {t("page.verwaltung.vertraege.btn.unlink")}
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>{t("page.verwaltung.vertraege.doc.empty")}</p>
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
                                        <BoltIcon size={14} /> {t("page.verwaltung.vertraege.btn.attach_scan")}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        disabled={attachBusy}
                                        loading={attachBusy}
                                        onClick={() => void attachLocalPdfToSelected()}
                                    >
                                        {t("page.verwaltung.vertraege.btn.pick_pdf")}
                                    </Button>
                                </div>
                            ) : null}
                        </FormSection>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {t("page.verwaltung.vertraege.empty_detail")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="verwaltung-menu-page praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                title={t("page.verwaltung.vertraege.title")}
                subtitle={t("page.verwaltung.vertraege.subtitle")}
                actions={
                    canWrite ? (
                        <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? cancelCreate : openCreate}>
                            {creating ? t("common.cancel") : t("page.verwaltung.vertraege.btn.create")}
                        </Button>
                    ) : null
                }
            />

            {!hydrated ? (
                <p className="page-sub" style={{ margin: 0 }}>{t("page.verwaltung.vertraege.loading")}</p>
            ) : (
                <div className="produkte-workspace">
                    <div className="produkte-workspace__list">
                        <div className="card produkte-table-card tbl-data-card tbl-scroll">
                            <table className="tbl produkte-tbl tbl-fluid">
                                <thead>
                                    <tr>
                                        <th scope="col" style={{ width: 40 }} aria-hidden> </th>
                                        <th scope="col">{t("page.verwaltung.vertraege.col.designation_partner")}</th>
                                        <th scope="col" style={{ textAlign: "end", whiteSpace: "nowrap" }}>{t("page.verwaltung.vertraege.col.amount_interval")}</th>
                                        <th scope="col">{t("page.verwaltung.vertraege.col.runtime")}</th>
                                        <th scope="col" style={{ whiteSpace: "nowrap" }}>{t("page.verwaltung.vertraege.col.status")}</th>
                                        <th scope="col" style={{ textAlign: "end", minWidth: 100 }}>{t("page.verwaltung.vertraege.col.reference")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vertraege.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="page-sub" style={{ padding: 20 }}>
                                                {t("page.verwaltung.vertraege.empty_table")}
                                            </td>
                                        </tr>
                                    ) : (
                                        vertraege.map((v) => {
                                            const aktiv = vertragAktivHeute(v);
                                            const isSel = !creating && selected?.id === v.id;
                                            return (
                                                <tr
                                                    key={v.id}
                                                    className={isSel ? "produkte-row--selected" : undefined}
                                                    onClick={() => selectRow(v)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <td style={{ color: "var(--fg-3)", textAlign: "center" }} title={v.dokumentPfad ? t("page.verwaltung.vertraege.title_with_doc") : undefined}>
                                                        {v.dokumentPfad ? "📎" : "📄"}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{v.bezeichnung}</div>
                                                        <div style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 2 }}>{v.partner}</div>
                                                    </td>
                                                    <td style={{ textAlign: "end", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                        {formatVertragbetragzeile(v.betrag, v.intervall)}
                                                    </td>
                                                    <td style={{ fontSize: 13, color: "var(--fg-2)" }}>{formatVertragLaufzeit(v)}</td>
                                                    <td>
                                                        {aktiv ? <Badge variant="success">{t("page.verwaltung.vertraege.badge.active")}</Badge> : <Badge variant="warning">{t("page.verwaltung.vertraege.badge.outside")}</Badge>}
                                                    </td>
                                                    <td style={{ textAlign: "end", fontSize: 12, color: "var(--fg-3)" }}>
                                                        {formatMonatsaequivalenzText(v)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="produkte-workspace__detail">{sidePanel}</div>
                </div>
            )}

            <Dialog
                open={scanDialogOpen}
                onClose={() => {
                    if (attachBusy) return;
                    setScanDialogOpen(false);
                }}
                title={t("page.verwaltung.vertraege.scan.dialog_title")}
                footer={(
                    <Button type="button" variant="ghost" onClick={() => setScanDialogOpen(false)} disabled={attachBusy}>
                        {t("common.close")}
                    </Button>
                )}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p className="page-sub" style={{ margin: 0, fontSize: 13 }}>
                        {tp("page.verwaltung.vertraege.scan.intro", { name: selected?.bezeichnung ?? "" })}
                    </p>
                    <Input
                        id="vertrag-scan-folder"
                        label={t("page.verwaltung.vertraege.field.scan_folder")}
                        value={scanFolder}
                        onChange={(e) => setScanFolder(e.target.value)}
                        placeholder={t("page.verwaltung.vertraege.field.scan_folder_ph")}
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
                                        toast(tp("page.verwaltung.vertraege.toast.scanner_app_error", { message: errorMessage(e) }), "error");
                                    }
                                })();
                            }}
                        >
                            {t("page.verwaltung.vertraege.btn.scanner_open")}
                        </Button>
                        <Button type="button" onClick={() => void refreshScanList()} disabled={scanBusy} loading={scanBusy}>
                            {t("page.verwaltung.vertraege.btn.refresh_list")}
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
                                        <span style={{ color: "var(--fg-3)" }}>{tp("page.verwaltung.vertraege.scan.bytes", { bytes: d.bytes })}</span>
                                    </span>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        disabled={attachBusy}
                                        loading={attachBusy}
                                        onClick={() => void attachScanToSelected(d.path)}
                                    >
                                        {t("page.verwaltung.vertraege.scan.apply")}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>{t("page.verwaltung.vertraege.scan.empty")}</p>
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
                            await deleteVertragOnBackend(rid);
                            await refreshFromBackend();
                            setSelected((s) => (s?.id === rid ? null : s));
                            setDeleteId(null);
                            setDetailEdit(false);
                            toast(t("page.verwaltung.vertraege.toast.deleted"), "success");
                        } catch (e) {
                            toast(tp("page.verwaltung.vertraege.toast.delete_error", { message: errorMessage(e) }), "error");
                        }
                    })();
                }}
                title={t("page.verwaltung.vertraege.confirm.delete_title")}
                message={t("page.verwaltung.vertraege.confirm.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />
        </div>
    );
}
