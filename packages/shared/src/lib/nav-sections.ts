/** Sidebar section ordering — keys must exist in {@link NAV_ITEM_DEFINITIONS} (`rbac.ts`). */
import { INBOX_UI_ENABLED } from "./inbox-config";
import {
    SERVICES_MENU_ENABLED,
    PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED,
} from "./catalog-menu-flags";

export type NavSectionDefinition = { labelKey: string; items: string[] };

const TREATMENT_ITEMS: string[] = [
    "/patients",
    "/charts/to-validate",
    ...(INBOX_UI_ENABLED ? ["/inbox"] : []),
    "/tickets",
    ...(PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED ? ["/prescriptions"] : []),
    "/statistics",
];

export const NAV_SECTIONS: NavSectionDefinition[] = [
    { labelKey: "nav.section.overview", items: ["/", "/appointments"] },
    {
        labelKey: "nav.section.clinical",
        items: TREATMENT_ITEMS,
    },
    {
        labelKey: "nav.section.practice",
        items: [
            "/finance",
            "/finance/cash",
            "/purchase-orders",
            ...(SERVICES_MENU_ENABLED ? ["/services"] : []),
            "/staff/work-time",
            // One-person editions reach Administration from Settings (editions plan §6.9).
            ...(__CAP_MULTI_STAFF__ ? ["/administration"] : []),
            "/settings",
        ],
    },
];
