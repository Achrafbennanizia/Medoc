/** Treatment-type filter options derived from overview rows (kept out of the filters component file). */
import { localizeChartRows } from "@/lib/statistics-chart-labels";

export type TreatmentKindOption = { value: string; label: string };

export function treatmentKindFilterOptions(
    rows: { label: string }[],
    t: (key: string) => string,
): TreatmentKindOption[] {
    const labeled = localizeChartRows(
        rows.map((r) => ({ label: r.label, value: 0 })),
        t,
        "treatment_category",
    );
    const seen = new Set<string>();
    return rows
        .map((r, i) => ({ value: r.label, label: labeled[i]?.label ?? r.label }))
        .filter((o) => {
            if (seen.has(o.value)) return false;
            seen.add(o.value);
            return true;
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}
