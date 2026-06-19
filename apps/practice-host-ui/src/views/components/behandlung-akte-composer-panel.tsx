import { useT } from "@/lib/i18n";
import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { Patientenakte, Zahnbefund, BehandlungsKatalogItem } from "@/models/types";
import type { PlanNextTerminV2 } from "@/lib/plan-next-termin";
import { planNextHasContent as planNextHasContentFn } from "@/lib/plan-next-termin";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import { DentalChart } from "./DentalChart";

export type BehandAkteFormState = {
    datum: string;
    kategorie: string;
    leistungsname: string;
    leistungKatalogId: string;
    behandlungsnummer: string;
    sitzung: string;
    gesamtkosten: string;
    behandlung_status: string;
    termin_erforderlich: string;
    notizen: string;
};

export type BehandlungAkteComposerPanelProps = {
    navigate: NavigateFunction;
    akte: Patientenakte | null;
    befunde: Zahnbefund[];
    selectedBehandTooth: string | null;
    onSelectTooth: (t: string | null) => void;
    behandEditId: string | null;
    behandComposerMode: "new" | "continue" | null;
    behandFieldsLocked: boolean;
    onUnlockFields: () => void;
    onCancelComposer: () => void;
    continueBehandlungOptions: { value: string; label: string }[];
    continueFromBehandlungId: string;
    applyContinueFromBehandlung: (behandlungId: string) => void;
    behandForm: BehandAkteFormState;
    setBehandForm: Dispatch<SetStateAction<BehandAkteFormState>>;
    kategorieOptions: { value: string; label: string }[];
    leistungOptions: { value: string; label: string }[];
    katalog: BehandlungsKatalogItem[];
    planNext: PlanNextTerminV2;
    runSaveBehandlung: () => void | Promise<void>;
};

export function BehandlungAkteComposerPanel({
    navigate,
    akte,
    befunde,
    selectedBehandTooth,
    onSelectTooth,
    behandEditId,
    behandComposerMode,
    behandFieldsLocked,
    onUnlockFields,
    onCancelComposer,
    continueBehandlungOptions,
    continueFromBehandlungId,
    applyContinueFromBehandlung,
    behandForm,
    setBehandForm,
    kategorieOptions,
    leistungOptions,
    katalog,
    planNext,
    runSaveBehandlung,
}: BehandlungAkteComposerPanelProps) {
    const t = useT();
    const statusLabel =
        behandForm.behandlung_status === "GEPLANT"
            ? t("behandlung.composer.status_planned")
            : behandForm.behandlung_status === "IN_BEARBEITUNG"
              ? t("behandlung.composer.status_in_progress")
              : t("behandlung.composer.status_done");

    return (
        <div id="ak-behand-composer-panel" className="akte-inline-panel" role="region" aria-label={t("behandlung.composer.aria")}>
            <div className="akte-inline-panel-head">
                <div>
                    <div className="akte-inline-panel-title">
                        {behandEditId
                            ? t("behandlung.composer.title_edit")
                            : behandComposerMode === "continue"
                              ? t("behandlung.composer.title_continue")
                              : t("behandlung.composer.title_new")}
                    </div>
                    <div className="akte-inline-panel-sub">
                        {t("behandlung.composer.auto_assigned")}
                        {" "}
                        <strong>{behandForm.behandlungsnummer || t("common.dash")}</strong>
                        {" · "}
                        {t("behandlung.composer.session")} <strong>{behandForm.sitzung || t("common.dash")}</strong>
                        {" · "}
                        {t("behandlung.composer.status_field")} <strong>{statusLabel}</strong>
                        {behandFieldsLocked ? t("behandlung.composer.locked_hint") : null}
                    </div>
                </div>
                <div className="row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {behandFieldsLocked ? (
                        <Button type="button" variant="secondary" size="sm" onClick={onUnlockFields}>
                            {t("common.edit")}
                        </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" onClick={onCancelComposer}>
                        {t("common.cancel")}
                    </Button>
                </div>
            </div>
            <div className="akte-inline-panel-body">
                {behandComposerMode === "continue" && continueBehandlungOptions.length > 0 ? (
                    <div style={{ marginBottom: 14 }}>
                        <Select
                            label={t("behandlung.composer.continue_from")}
                            value={continueFromBehandlungId || continueBehandlungOptions[0]?.value || ""}
                            options={continueBehandlungOptions}
                            disabled={behandFieldsLocked}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v) applyContinueFromBehandlung(v);
                            }}
                        />
                        <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>
                            {t("behandlung.composer.continue_hint")}
                        </p>
                    </div>
                ) : null}
                {akte ? (
                    <DentalChart
                        mode="picker"
                        befunde={befunde}
                        selectedTooth={selectedBehandTooth}
                        onToothSelect={onSelectTooth}
                        disabled={behandFieldsLocked}
                    />
                ) : null}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginTop: 16 }}>
                    <Input
                        id="bh-datum"
                        type="date"
                        label={t("behandlung.composer.date")}
                        value={behandForm.datum}
                        disabled={behandFieldsLocked}
                        onChange={(e) => setBehandForm({ ...behandForm, datum: e.target.value })}
                    />
                    <Input
                        id="bh-zahn"
                        label={t("behandlung.composer.tooth")}
                        value={selectedBehandTooth ?? ""}
                        disabled={behandFieldsLocked}
                        onChange={(e) => onSelectTooth(e.target.value.trim() || null)}
                        placeholder={t("behandlung.composer.tooth_ph")}
                    />
                    <Select
                        label={t("behandlung.composer.category")}
                        value={behandForm.kategorie}
                        options={kategorieOptions}
                        disabled={behandFieldsLocked}
                        onChange={(e) => {
                            const v = e.target.value;
                            setBehandForm({
                                ...behandForm,
                                kategorie: v,
                                leistungsname: "",
                                leistungKatalogId: "",
                                gesamtkosten: "",
                            });
                        }}
                    />
                    <div className="col" style={{ gap: 8 }}>
                        <Select
                            label={t("behandlung.composer.service_catalog")}
                            value={behandForm.leistungKatalogId || ""}
                            options={leistungOptions}
                            disabled={behandFieldsLocked}
                            onChange={(e) => {
                                const idSel = e.target.value;
                                const item = katalog.find((k) => k.id === idSel);
                                setBehandForm({
                                    ...behandForm,
                                    leistungKatalogId: idSel,
                                    leistungsname: item?.name ?? "",
                                    kategorie: item?.kategorie ?? behandForm.kategorie,
                                    gesamtkosten:
                                        item?.default_kosten != null && Number.isFinite(item.default_kosten)
                                            ? String(item.default_kosten)
                                            : behandForm.gesamtkosten,
                                });
                            }}
                        />
                        <Input
                            id="bh-leist-text"
                            label={t("behandlung.composer.service_name")}
                            value={behandForm.leistungsname}
                            disabled={behandFieldsLocked}
                            onChange={(e) =>
                                setBehandForm({
                                    ...behandForm,
                                    leistungsname: e.target.value,
                                    leistungKatalogId: "",
                                })
                            }
                            placeholder={t("behandlung.composer.catalog_ph")}
                        />
                    </div>
                    <Input
                        id="bh-kosten"
                        label={t("behandlung.composer.cost")}
                        value={behandForm.gesamtkosten}
                        disabled={behandFieldsLocked}
                        onChange={(e) => setBehandForm({ ...behandForm, gesamtkosten: e.target.value })}
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
                        behandForm.termin_erforderlich === "1"
                        || behandForm.notizen.trim().length > 0
                        || planNextHasContentFn(planNext)
                    }
                >
                    <summary style={{ cursor: behandFieldsLocked ? "default" : "pointer", fontWeight: 600, fontSize: 13.5 }}>
                        {t("behandlung.composer.plan_next")}
                    </summary>
                    <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "8px 0 12px" }}>
                        {t("behandlung.composer.plan_next_hint")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label={t("behandlung.composer.status_field")}
                            value={behandForm.behandlung_status}
                            options={[
                                { value: "GEPLANT", label: t("behandlung.composer.status_planned") },
                                { value: "IN_BEARBEITUNG", label: t("behandlung.composer.status_in_progress") },
                                { value: "DURCHGEFUEHRT", label: t("behandlung.composer.status_done") },
                            ]}
                            disabled={behandFieldsLocked}
                            onChange={(e) => setBehandForm({ ...behandForm, behandlung_status: e.target.value })}
                        />
                        <Select
                            label={t("behandlung.composer.termin_required")}
                            value={behandForm.termin_erforderlich}
                            options={[
                                { value: "0", label: t("common.no") },
                                { value: "1", label: t("behandlung.composer.followup_yes") },
                            ]}
                            disabled={behandFieldsLocked}
                            onChange={(e) => setBehandForm({ ...behandForm, termin_erforderlich: e.target.value })}
                        />
                    </div>
                    <Textarea
                        id="bh-notes"
                        label={t("behandlung.composer.notes")}
                        value={behandForm.notizen}
                        disabled={behandFieldsLocked}
                        onChange={(e) => setBehandForm({ ...behandForm, notizen: e.target.value })}
                        placeholder={t("behandlung.composer.notes_ph")}
                        className="min-h-[72px] mt-2"
                    />
                </details>
            </div>

            <div className="akte-inline-panel-actions">
                <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/behandlungs-katalog")}>
                    {t("behandlung.composer.manage_catalog")}
                </Button>
                <Button type="button" onClick={() => void runSaveBehandlung()} disabled={!akte || behandFieldsLocked}>
                    {behandEditId ? t("behandlung.composer.save_changes") : t("behandlung.composer.save")}
                </Button>
            </div>
        </div>
    );
}
