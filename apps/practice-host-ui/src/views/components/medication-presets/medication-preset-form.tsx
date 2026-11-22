/** Fields of one predefined medication (create and edit). */
import { useT } from "@/lib/i18n";
import { DOSAGE_FORM_OPTIONS, PACK_SIZE_OPTIONS } from "@/lib/medications";
import { Input, Select, Textarea } from "../ui/input";
import type { MedicationForm } from "./medication-presets-adapter";

export function MedicationPresetForm({ form, setForm, idPrefix }: { form: MedicationForm; setForm: (f: MedicationForm) => void; idPrefix: string }) {
    const t = useT();
    const set = <K extends keyof MedicationForm>(key: K, value: MedicationForm[K]) => setForm({ ...form, [key]: value });
    const none = { value: "", label: t("common.em_dash") };
    return (
        <div className="master-detail-form__grid">
            <Input id={`${idPrefix}-label`} label={t("medication_presets.field.label")} required value={form.label} onChange={(e) => set("label", e.target.value)} />
            <Input id={`${idPrefix}-ingredient`} label={t("medication_presets.field.active_ingredient")} value={form.active_ingredient} onChange={(e) => set("active_ingredient", e.target.value)} />
            <Select
                id={`${idPrefix}-form`}
                label={t("medication_presets.field.dosage_form")}
                value={form.dosage_form}
                onChange={(e) => set("dosage_form", e.target.value)}
                options={[none, ...DOSAGE_FORM_OPTIONS.map((o) => ({ value: o, label: o }))]}
            />
            <Select
                id={`${idPrefix}-pack`}
                label={t("medication_presets.field.pack_size")}
                value={form.pack_size}
                onChange={(e) => set("pack_size", e.target.value)}
                options={[none, ...PACK_SIZE_OPTIONS.map((o) => ({ value: o, label: o }))]}
            />
            <Input id={`${idPrefix}-dosage`} label={t("medication_presets.field.dosage")} placeholder="1-0-1" value={form.dosage} onChange={(e) => set("dosage", e.target.value)} />
            <Input id={`${idPrefix}-duration`} label={t("medication_presets.field.duration")} value={form.duration} onChange={(e) => set("duration", e.target.value)} />
            <div className="master-detail-form__wide">
                <Textarea id={`${idPrefix}-instructions`} label={t("medication_presets.field.instructions")} rows={2} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} />
            </div>
            <Select
                id={`${idPrefix}-active`}
                label={t("common.status")}
                value={form.active ? "1" : "0"}
                onChange={(e) => set("active", e.target.value === "1")}
                options={[
                    { value: "1", label: t("common.active") },
                    { value: "0", label: t("common.inactive") },
                ]}
            />
        </div>
    );
}
