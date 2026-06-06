/** Sidebar section ordering — keys must exist in {@link NAV_ITEM_DEFINITIONS} (`rbac.ts`). */
export type NavSectionDefinition = { label: string; items: string[] };

export const NAV_SECTIONS: NavSectionDefinition[] = [
    { label: "Übersicht", items: ["/", "/termine"] },
    {
        label: "Behandlung",
        items: ["/patienten", "/akten/zu-validieren", "/posteingang", "/tickets", "/rezepte", "/statistik"],
    },
    {
        label: "Praxis",
        items: ["/finanzen", "/verwaltung/finanzen-berichte/tagesabschluss", "/bestellungen", "/verwaltung", "/einstellungen"],
    },
];
