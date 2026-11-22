/**
 * Administration → Services, catalogs & templates → Predefined medications. The practice's own
 * medication list: every prescription screen suggests from it and prefills dosage and duration.
 */
import { useMemo } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { emptyMedicationPreset, type MedicationPreset } from "@/lib/medication-catalog";
import { useRbac } from "@/lib/use-rbac";
import { errorMessage } from "@/lib/utils";
import { MedicationPresetForm } from "../components/medication-presets/medication-preset-form";
import { medicationPresetsAdapter, type MedicationForm } from "../components/medication-presets/medication-presets-adapter";
import { MasterDetailCrudPage } from "../components/master-detail/master-detail-crud-page";
import { MasterDetailOverview } from "../components/master-detail/master-detail-overview";
import { ReadField } from "../components/master-detail/read-field";
import { useMasterDetailCrud } from "../components/master-detail/use-master-detail-crud";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useToastStore } from "../components/ui/toast-store";

const toForm = (m: MedicationPreset): MedicationForm => {
    const { id, ...rest } = m;
    void id;
    return rest;
};
const emptyForm = (): MedicationForm => toForm(emptyMedicationPreset());

export function MedicationPresetsPage() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const canWrite = useRbac().can("administration.templates.write");
    const crud = useMasterDetailCrud<MedicationPreset, MedicationForm>({
        adapter: medicationPresetsAdapter,
        emptyForm,
        toForm,
        isValid: (f) => f.label.trim().length > 0,
        getId: (m) => m.id,
        onError: (e) => toast(errorMessage(e), "error"),
        onSaved: (kind) => toast(t(`medication_presets.toast.${kind}`), "success"),
    });
    const active = useMemo(() => crud.items.filter((m) => m.active).length, [crud.items]);

    return (
        <MasterDetailCrudPage
            crud={crud}
            canWrite={canWrite}
            getId={(m) => m.id}
            itemTitle={(m) => m.label}
            emptyIcon="💊"
            texts={{
                title: t("medication_presets.title"),
                subtitle: t("medication_presets.subtitle"),
                entity: t("medication_presets.entity"),
                createButton: t("medication_presets.create"),
                createTitle: t("medication_presets.create"),
                readSubtitle: t("medication_presets.read_sub"),
                editSubtitle: t("medication_presets.edit_sub"),
                empty: t("medication_presets.empty"),
                emptyHint: t("medication_presets.empty_hint"),
                deleteTitle: t("medication_presets.delete_title"),
                deleteMessage: t("medication_presets.delete_message"),
            }}
            columns={[
                {
                    id: "label",
                    header: t("medication_presets.field.label"),
                    truncate: true,
                    text: (m) => m.label,
                    cell: (m) => (
                        <>
                            <span className="data-table__primary">{m.label}</span>
                            {!m.active ? (
                                <span className="data-table__badge-after">
                                    <Badge variant="warning">{t("common.inactive")}</Badge>
                                </span>
                            ) : null}
                        </>
                    ),
                },
                { id: "ingredient", header: t("medication_presets.field.active_ingredient"), width: "30%", truncate: true, hideBelow: "md", text: (m) => m.active_ingredient, cell: (m) => m.active_ingredient },
                { id: "dosage", header: t("medication_presets.field.dosage"), width: "7rem", cell: (m) => m.dosage },
            ]}
            renderForm={(form, setForm, idPrefix) => <MedicationPresetForm form={form} setForm={setForm} idPrefix={idPrefix} />}
            renderRead={(m) => (
                <div className="master-detail-read">
                    <ReadField label={t("medication_presets.field.active_ingredient")} value={m.active_ingredient} />
                    <ReadField label={t("medication_presets.field.dosage_form")} value={m.dosage_form} />
                    <ReadField label={t("medication_presets.field.dosage")} value={m.dosage} />
                    <ReadField label={t("medication_presets.field.duration")} value={m.duration} />
                    <ReadField label={t("medication_presets.field.pack_size")} value={m.pack_size} />
                    <ReadField label={t("common.status")} value={m.active ? t("common.active") : t("common.inactive")} />
                    <ReadField label={t("medication_presets.field.instructions")} value={m.instructions} wide />
                </div>
            )}
            overview={
                <MasterDetailOverview
                    title={t("medication_presets.overview.title")}
                    facts={[{ label: t("medication_presets.overview.active"), value: tp("medication_presets.overview.active_value", { active, total: crud.items.length }) }]}
                    hint={t("medication_presets.overview.hint")}
                    action={canWrite ? <Button type="button" onClick={crud.openCreate}>{t("medication_presets.create")}</Button> : null}
                />
            }
        />
    );
}
