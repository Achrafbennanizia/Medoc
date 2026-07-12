/** Canonical category values persisted in `behandlungs_katalog.kategorie` (seed/DB). */
export const DEFAULT_CATALOG_CATEGORIES = [
    "Kontrolluntersuchung",
    "Fuellungstherapie",
    "Parodontologie",
    "Chirurgie",
    "Prothetik",
] as const;

export type DefaultCatalogCategory = (typeof DEFAULT_CATALOG_CATEGORIES)[number];

/** DB category used for default examination billing (FA-LEIST-07). */
export const EXAMINATION_CATALOG_CATEGORY: DefaultCatalogCategory = "Kontrolluntersuchung";

const CATEGORY_LABEL_KEYS: Record<DefaultCatalogCategory, string> = {
    Kontrolluntersuchung: "enum.behandlungs_katalog.kategorie.kontrolluntersuchung",
    Fuellungstherapie: "enum.behandlungs_katalog.kategorie.fuellungstherapie",
    Parodontologie: "enum.behandlungs_katalog.kategorie.parodontologie",
    Chirurgie: "enum.behandlungs_katalog.kategorie.chirurgie",
    Prothetik: "enum.behandlungs_katalog.kategorie.prothetik",
};

type TFn = (key: string) => string;

export function isDefaultCatalogCategory(value: string): value is DefaultCatalogCategory {
    return (DEFAULT_CATALOG_CATEGORIES as readonly string[]).includes(value);
}

/** Localized label for a catalog category; custom DB values pass through unchanged. */
export function behandlungsKatalogCategoryLabel(t: TFn, value: string): string {
    if (isDefaultCatalogCategory(value)) return t(CATEGORY_LABEL_KEYS[value]);
    return value;
}

export function buildBehandlungsKatalogCategoryOptions(
    t: TFn,
    values: Iterable<string>,
    sortLocale: string,
): { value: string; label: string }[] {
    const uniq = [...new Set(values)].filter(Boolean);
    return uniq
        .sort((a, b) =>
            behandlungsKatalogCategoryLabel(t, a).localeCompare(
                behandlungsKatalogCategoryLabel(t, b),
                sortLocale,
            ),
        )
        .map((value) => ({ value, label: behandlungsKatalogCategoryLabel(t, value) }));
}
