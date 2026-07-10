/** Sidebar section ordering — keys must exist in {@link NAV_ITEM_DEFINITIONS} (`rbac.ts`). */
import { POSTEINGANG_UI_ENABLED } from "./posteingang-config";
import {
    LEISTUNGEN_MENU_ENABLED,
    REZEPTE_ATTESTE_MENU_ENABLED,
} from "./catalog-menu-flags";

export type NavSectionDefinition = { labelKey: string; items: string[] };

const BEHANDLUNG_ITEMS: string[] = [
    "/patienten",
    "/akten/zu-validieren",
    ...(POSTEINGANG_UI_ENABLED ? ["/posteingang"] : []),
    "/tickets",
    ...(REZEPTE_ATTESTE_MENU_ENABLED ? ["/rezepte"] : []),
    "/statistik",
];

export const NAV_SECTIONS: NavSectionDefinition[] = [
    { labelKey: "nav.section.overview", items: ["/", "/termine"] },
    {
        labelKey: "nav.section.clinical",
        items: BEHANDLUNG_ITEMS,
    },
    {
        labelKey: "nav.section.practice",
        items: [
            "/finanzen",
            "/finanzen/kasse",
            "/bestellungen",
            ...(LEISTUNGEN_MENU_ENABLED ? ["/leistungen"] : []),
            "/personal/arbeitszeit",
            "/verwaltung",
            "/einstellungen",
        ],
    },
];
