/**
 * Administration → Services, catalogs & templates → Predefined prescriptions: named combinations of
 * medications (e.g. "After extraction") that the prescription screens insert in one step.
 */
import { useT, useTParams } from "@/lib/i18n";
import { useRbac } from "@/lib/use-rbac";
import { errorMessage, formatDateTime } from "@/lib/utils";
import type { DocumentTemplate } from "@/models/types";
import { MasterDetailCrudPage } from "../components/master-detail/master-detail-crud-page";
import { MasterDetailOverview } from "../components/master-detail/master-detail-overview";
import { ReadField } from "../components/master-detail/read-field";
import { useMasterDetailCrud } from "../components/master-detail/use-master-detail-crud";
import { PresetLinesEditor } from "../components/prescription-presets/preset-lines-editor";
import { emptyPresetLine, prescriptionPresetsAdapter, presetLines, type PrescriptionPresetForm } from "../components/prescription-presets/prescription-presets-adapter";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";

const emptyForm = (): PrescriptionPresetForm => ({ title: "", lines: [emptyPresetLine()] });
const toForm = (d: DocumentTemplate): PrescriptionPresetForm => {
    const lines = presetLines(d);
    return { title: d.title, lines: lines.length ? lines : [emptyPresetLine()] };
};
const isValid = (f: PrescriptionPresetForm) => f.title.trim().length > 0 && f.lines.some((l) => l.medication.trim());

export function PrescriptionPresetsPage() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const canWrite = useRbac().can("administration.templates.write");
    const crud = useMasterDetailCrud<DocumentTemplate, PrescriptionPresetForm>({
        adapter: prescriptionPresetsAdapter,
        emptyForm,
        toForm,
        isValid,
        getId: (d) => d.id,
        onError: (e) => toast(errorMessage(e), "error"),
        onSaved: (kind) => toast(t(`prescription_presets.toast.${kind}`), "success"),
    });

    return (
        <MasterDetailCrudPage
            crud={crud}
            canWrite={canWrite}
            getId={(d) => d.id}
            itemTitle={(d) => d.title}
            emptyIcon="📝"
            texts={{
                title: t("prescription_presets.title"),
                subtitle: t("prescription_presets.subtitle"),
                entity: t("prescription_presets.entity"),
                createButton: t("prescription_presets.create"),
                createTitle: t("prescription_presets.create"),
                readSubtitle: t("prescription_presets.read_sub"),
                editSubtitle: t("prescription_presets.edit_sub"),
                empty: t("prescription_presets.empty"),
                emptyHint: t("prescription_presets.empty_hint"),
                deleteTitle: t("prescription_presets.delete_title"),
                deleteMessage: t("prescription_presets.delete_message"),
            }}
            columns={[
                { id: "title", header: t("prescription_presets.field.title"), truncate: true, text: (d) => d.title, cell: (d) => <span className="data-table__primary">{d.title}</span> },
                {
                    id: "medications",
                    header: t("prescription_presets.field.medications"),
                    truncate: true,
                    hideBelow: "md",
                    text: (d) => presetLines(d).map((l) => l.medication).join(", "),
                    cell: (d) => presetLines(d).map((l) => l.medication).join(", "),
                },
                { id: "count", header: t("prescription_presets.field.count"), width: "6rem", numeric: true, cell: (d) => presetLines(d).length },
            ]}
            renderForm={(form, setForm, idPrefix) => (
                <>
                    <Input id={`${idPrefix}-title`} label={t("prescription_presets.field.title")} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    <PresetLinesEditor lines={form.lines} onChange={(lines) => setForm({ ...form, lines })} idPrefix={idPrefix} />
                </>
            )}
            renderRead={(d) => (
                <div className="master-detail-read">
                    {presetLines(d).map((l, i) => (
                        <ReadField key={i} wide label={`${i + 1}. ${l.medication}`} value={[l.dosage, l.duration, l.description].filter(Boolean).join(" · ")} />
                    ))}
                    <ReadField wide label={t("prescription_presets.field.updated")} value={tp("common.last_modified", { date: formatDateTime(d.updated_at) })} />
                </div>
            )}
            overview={
                <MasterDetailOverview
                    title={t("prescription_presets.overview.title")}
                    facts={[{ label: t("prescription_presets.overview.count"), value: crud.items.length }]}
                    hint={t("prescription_presets.overview.hint")}
                    action={canWrite ? <Button type="button" onClick={crud.openCreate}>{t("prescription_presets.create")}</Button> : null}
                />
            }
        />
    );
}
