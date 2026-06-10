/** Sidebar section ordering — keys must exist in {@link NAV_ITEM_DEFINITIONS} (`rbac.ts`). */
import { POSTEINGANG_UI_ENABLED } from "./posteingang-config";

export type NavSectionDefinition = { label: string; items: string[] };

const BEHANDLUNG_ITEMS: string[] = [
    "/patienten",
    "/akten/zu-validieren",
    ...(POSTEINGANG_UI_ENABLED ? ["/posteingang"] : []),
    "/tickets",
    "/rezepte",
    "/statistik",
];

export const NAV_SECTIONS: NavSectionDefinition[] = [
    { label: "Übersicht", items: ["/", "/termine"] },
    {
        label: "Behandlung",
        items: BEHANDLUNG_ITEMS,
    },
    {
        label: "Praxis",
        items: ["/finanzen", "/finanzen/kasse", "/bestellungen", "/verwaltung", "/einstellungen"],
    },
];
