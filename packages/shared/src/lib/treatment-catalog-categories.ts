/** Canonical category values persisted in `treatment_catalog.category` (seed/DB). */
export const DEFAULT_CATALOG_CATEGORIES = [
    "Checkup",
    "FillingTherapy",
    "Periodontology",
    "Surgery",
    "Prosthodontics",
] as const;

export type DefaultCatalogCategory = (typeof DEFAULT_CATALOG_CATEGORIES)[number];

/** DB category used for default examination billing (FA-LEIST-07). */
export const EXAMINATION_CATALOG_CATEGORY: DefaultCatalogCategory = "Checkup";

const CATEGORY_LABEL_KEYS: Record<DefaultCatalogCategory, string> = {
    Checkup: "enum.treatment_catalog.category.checkup",
    FillingTherapy: "enum.treatment_catalog.category.filling_therapy",
    Periodontology: "enum.treatment_catalog.category.periodontology",
    Surgery: "enum.treatment_catalog.category.surgery",
    Prosthodontics: "enum.treatment_catalog.category.prosthodontics",
};

type TFn = (key: string) => string;

export function isDefaultCatalogCategory(value: string): value is DefaultCatalogCategory {
    return (DEFAULT_CATALOG_CATEGORIES as readonly string[]).includes(value);
}

/** Localized label for a catalog category; custom DB values pass through unchanged. */
export function treatmentCatalogCategoryLabel(t: TFn, value: string): string {
    if (isDefaultCatalogCategory(value)) return t(CATEGORY_LABEL_KEYS[value]);
    return value;
}

export function buildTreatmentCatalogCategoryOptions(
    t: TFn,
    values: Iterable<string>,
    sortLocale: string,
): { value: string; label: string }[] {
    const uniq = [...new Set(values)].filter(Boolean);
    return uniq
        .sort((a, b) =>
            treatmentCatalogCategoryLabel(t, a).localeCompare(
                treatmentCatalogCategoryLabel(t, b),
                sortLocale,
            ),
        )
        .map((value) => ({ value, label: treatmentCatalogCategoryLabel(t, value) }));
}
