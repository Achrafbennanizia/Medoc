import { useT } from "@/lib/i18n";
import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { PatientChart, DentalFinding, TreatmentCatalogItem } from "@/models/types";
import type { PlanNextAppointmentV2 } from "@/lib/plan-next-appointment";
import { planNextHasContent as planNextHasContentFn } from "@/lib/plan-next-appointment";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import { DentalChart } from "./DentalChart";

export type TreatmentChartFormState = {
    date: string;
    category: string;
    service_name: string;
    serviceCatalogId: string;
    treatment_number: string;
    session_number: string;
    total_cost: string;
    treatment_status: string;
    appointment_required: string;
    notes: string;
};

export type TreatmentChartComposerPanelProps = {
    navigate: NavigateFunction;
    chart: PatientChart | null;
    findings: DentalFinding[];
    selectedTreatmentTooth: string | null;
    onSelectTooth: (t: string | null) => void;
    treatmentEditId: string | null;
    treatmentComposerMode: "new" | "continue" | null;
    treatmentFieldsLocked: boolean;
    onUnlockFields: () => void;
    onCancelComposer: () => void;
    continueTreatmentOptions: { value: string; label: string }[];
    continueFromTreatmentId: string;
    applyContinueFromTreatment: (treatmentId: string) => void;
    treatmentForm: TreatmentChartFormState;
    setTreatmentForm: Dispatch<SetStateAction<TreatmentChartFormState>>;
    categoryOptions: { value: string; label: string }[];
    serviceCatalogOptions: { value: string; label: string }[];
    catalog: TreatmentCatalogItem[];
    planNext: PlanNextAppointmentV2;
    runSaveTreatment: () => void | Promise<void>;
};

export function TreatmentChartComposerPanel({
    navigate,
    chart,
    findings,
    selectedTreatmentTooth,
    onSelectTooth,
    treatmentEditId,
    treatmentComposerMode,
    treatmentFieldsLocked,
    onUnlockFields,
    onCancelComposer,
    continueTreatmentOptions,
    continueFromTreatmentId,
    applyContinueFromTreatment,
    treatmentForm,
    setTreatmentForm,
    categoryOptions,
    serviceCatalogOptions,
    catalog,
    planNext,
    runSaveTreatment,
}: TreatmentChartComposerPanelProps) {
    const t = useT();
    const statusLabel =
        treatmentForm.treatment_status === "PLANNED"
            ? t("treatment.composer.status_planned")
            : treatmentForm.treatment_status === "IN_PROGRESS"
              ? t("treatment.composer.status_in_progress")
              : t("treatment.composer.status_done");

    return (
        <div id="ak-treatment-composer-panel" className="chart-inline-panel" role="region" aria-label={t("treatment.composer.aria")}>
            <div className="chart-inline-panel-head">
                <div>
                    <div className="chart-inline-panel-title">
                        {treatmentEditId
                            ? t("treatment.composer.title_edit")
                            : treatmentComposerMode === "continue"
                              ? t("treatment.composer.title_continue")
                              : t("treatment.composer.title_new")}
                    </div>
                    <div className="chart-inline-panel-sub">
                        {t("treatment.composer.auto_assigned")}
                        {" "}
                        <strong>{treatmentForm.treatment_number || t("common.dash")}</strong>
                        {" · "}
                        {t("treatment.composer.session")} <strong>{treatmentForm.session_number || t("common.dash")}</strong>
                        {" · "}
                        {t("treatment.composer.status_field")} <strong>{statusLabel}</strong>
                        {treatmentFieldsLocked ? t("treatment.composer.locked_hint") : null}
                    </div>
                </div>
                <div className="row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {treatmentFieldsLocked ? (
                        <Button type="button" variant="secondary" size="sm" onClick={onUnlockFields}>
                            {t("common.edit")}
                        </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" onClick={onCancelComposer}>
                        {t("common.cancel")}
                    </Button>
                </div>
            </div>
            <div className="chart-inline-panel-body">
                {treatmentComposerMode === "continue" && continueTreatmentOptions.length > 0 ? (
                    <div style={{ marginBottom: 14 }}>
                        <Select
                            label={t("treatment.composer.continue_from")}
                            value={continueFromTreatmentId || continueTreatmentOptions[0]?.value || ""}
                            options={continueTreatmentOptions}
                            disabled={treatmentFieldsLocked}
                            onChange={(e) => {
                                const version = e.target.value;
                                if (version) applyContinueFromTreatment(version);
                            }}
                        />
                        <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>
                            {t("treatment.composer.continue_hint")}
                        </p>
                    </div>
                ) : null}
                {chart ? (
                    <DentalChart
                        mode="picker"
                        findings={findings}
                        selectedTooth={selectedTreatmentTooth}
                        onToothSelect={onSelectTooth}
                        disabled={treatmentFieldsLocked}
                    />
                ) : null}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginTop: 16 }}>
                    <Input
                        id="bh-date"
                        type="date"
                        label={t("treatment.composer.date")}
                        value={treatmentForm.date}
                        disabled={treatmentFieldsLocked}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, date: e.target.value })}
                    />
                    <Input
                        id="bh-zahn"
                        label={t("treatment.composer.tooth")}
                        value={selectedTreatmentTooth ?? ""}
                        disabled={treatmentFieldsLocked}
                        onChange={(e) => onSelectTooth(e.target.value.trim() || null)}
                        placeholder={t("treatment.composer.tooth_ph")}
                    />
                    <Select
                        label={t("treatment.composer.category")}
                        value={treatmentForm.category}
                        options={categoryOptions}
                        disabled={treatmentFieldsLocked}
                        onChange={(e) => {
                            const version = e.target.value;
                            setTreatmentForm({
                                ...treatmentForm,
                                category: version,
                                service_name: "",
                                serviceCatalogId: "",
                                total_cost: "",
                            });
                        }}
                    />
                    <div className="col" style={{ gap: 8 }}>
                        <Select
                            label={t("treatment.composer.service_catalog")}
                            value={treatmentForm.serviceCatalogId || ""}
                            options={serviceCatalogOptions}
                            disabled={treatmentFieldsLocked}
                            onChange={(e) => {
                                const idSel = e.target.value;
                                const item = catalog.find((k) => k.id === idSel);
                                setTreatmentForm({
                                    ...treatmentForm,
                                    serviceCatalogId: idSel,
                                    service_name: item?.name ?? "",
                                    category: item?.category ?? treatmentForm.category,
                                    total_cost:
                                        item?.default_cost != null && Number.isFinite(item.default_cost)
                                            ? String(item.default_cost)
                                            : treatmentForm.total_cost,
                                });
                            }}
                        />
                        <Input
                            id="bh-leist-text"
                            label={t("treatment.composer.service_name")}
                            value={treatmentForm.service_name}
                            disabled={treatmentFieldsLocked}
                            onChange={(e) =>
                                setTreatmentForm({
                                    ...treatmentForm,
                                    service_name: e.target.value,
                                    serviceCatalogId: "",
                                })
                            }
                            placeholder={t("treatment.composer.catalog_ph")}
                        />
                    </div>
                    <Input
                        id="bh-cost"
                        label={t("treatment.composer.cost")}
                        value={treatmentForm.total_cost}
                        disabled={treatmentFieldsLocked}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, total_cost: e.target.value })}
                    />
                </div>

                <details
                    style={{
                        marginTop: 16,
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        background: "rgba(0,0,0,0.015)",
                    }}
                    open={
                        treatmentForm.appointment_required === "1"
                        || treatmentForm.notes.trim().length > 0
                        || planNextHasContentFn(planNext)
                    }
                >
                    <summary style={{ cursor: treatmentFieldsLocked ? "default" : "pointer", fontWeight: 600, fontSize: 13.5 }}>
                        {t("treatment.composer.plan_next")}
                    </summary>
                    <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "8px 0 12px" }}>
                        {t("treatment.composer.plan_next_hint")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label={t("treatment.composer.status_field")}
                            value={treatmentForm.treatment_status}
                            options={[
                                { value: "PLANNED", label: t("treatment.composer.status_planned") },
                                { value: "IN_PROGRESS", label: t("treatment.composer.status_in_progress") },
                                { value: "COMPLETED", label: t("treatment.composer.status_done") },
                            ]}
                            disabled={treatmentFieldsLocked}
                            onChange={(e) => setTreatmentForm({ ...treatmentForm, treatment_status: e.target.value })}
                        />
                        <Select
                            label={t("treatment.composer.appointment_required")}
                            value={treatmentForm.appointment_required}
                            options={[
                                { value: "0", label: t("common.no") },
                                { value: "1", label: t("treatment.composer.followup_yes") },
                            ]}
                            disabled={treatmentFieldsLocked}
                            onChange={(e) => setTreatmentForm({ ...treatmentForm, appointment_required: e.target.value })}
                        />
                    </div>
                    <Textarea
                        id="bh-notes"
                        label={t("treatment.composer.notes")}
                        value={treatmentForm.notes}
                        disabled={treatmentFieldsLocked}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, notes: e.target.value })}
                        placeholder={t("treatment.composer.notes_ph")}
                        className="min-h-[72px] mt-2"
                    />
                </details>
            </div>

            <div className="chart-inline-panel-actions">
                <Button type="button" variant="secondary" onClick={() => navigate("/administration/treatment-catalog")}>
                    {t("treatment.composer.manage_catalog")}
                </Button>
                <Button type="button" onClick={() => void runSaveTreatment()} disabled={!chart || treatmentFieldsLocked}>
                    {treatmentEditId ? t("treatment.composer.save_changes") : t("treatment.composer.save")}
                </Button>
            </div>
        </div>
    );
}
