/**
 * Medication lines of a predefined prescription. The medication field suggests the practice's
 * predefined medications; picking one fills its active substance, dosage, duration and instructions when still empty.
 */
import { useId } from "react";
import { useT } from "@/lib/i18n";
import { medicationCatalogSnapshot } from "@/lib/medication-catalog";
import { MedicationDatalist } from "../medication-presets/medication-datalist";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { emptyPresetLine, type PresetLine } from "./prescription-presets-adapter";

export function PresetLinesEditor({ lines, onChange, idPrefix }: { lines: PresetLine[]; onChange: (lines: PresetLine[]) => void; idPrefix: string }) {
    const t = useT();
    const listId = `${useId()}-medications`;

    const setLine = (index: number, patch: Partial<PresetLine>) => onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    const pickMedication = (index: number, medication: string) => {
        const preset = medicationCatalogSnapshot().find((m) => m.label.toLowerCase() === medication.trim().toLowerCase());
        const line = lines[index]!;
        setLine(index, {
            medication,
            ...(preset && !line.active_ingredient ? { active_ingredient: preset.active_ingredient } : {}),
            ...(preset && !line.dosage ? { dosage: preset.dosage } : {}),
            ...(preset && !line.duration ? { duration: preset.duration } : {}),
            ...(preset && !line.description ? { description: preset.instructions } : {}),
        });
    };

    return (
        <div className="preset-lines">
            <MedicationDatalist id={listId} />
            {lines.map((line, i) => (
                <fieldset key={i} className="preset-lines__line">
                    <legend>{t("prescription_presets.line")} {i + 1}</legend>
                    <Input id={`${idPrefix}-med-${i}`} label={t("prescription_presets.field.medication")} list={listId} value={line.medication} onChange={(e) => pickMedication(i, e.target.value)} />
                    <Input id={`${idPrefix}-sub-${i}`} label={t("medication_presets.field.active_ingredient")} value={line.active_ingredient} onChange={(e) => setLine(i, { active_ingredient: e.target.value })} />
                    <Input id={`${idPrefix}-dos-${i}`} label={t("medication_presets.field.dosage")} placeholder="1-0-1" value={line.dosage} onChange={(e) => setLine(i, { dosage: e.target.value })} />
                    <Input id={`${idPrefix}-dur-${i}`} label={t("medication_presets.field.duration")} value={line.duration} onChange={(e) => setLine(i, { duration: e.target.value })} />
                    <Input id={`${idPrefix}-note-${i}`} label={t("medication_presets.field.instructions")} value={line.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                    {lines.length > 1 ? (
                        <Button type="button" size="sm" variant="ghost" className="preset-lines__remove" onClick={() => onChange(lines.filter((_, j) => j !== i))}>
                            {t("prescription_presets.remove_line")}
                        </Button>
                    ) : null}
                </fieldset>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...lines, emptyPresetLine()])}>
                {t("prescription_presets.add_line")}
            </Button>
        </div>
    );
}
