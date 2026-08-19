/** One level up within Administration (and top-level Wirtschaft pages opened from a hub). */

export type AdministrationBackTarget = { path: string; labelKey: string };

const VERWALTUNG: AdministrationBackTarget = { path: "/administration", labelKey: "nav.administration" };

const FINANCE_BERICHTE: AdministrationBackTarget = {
    path: "/administration/finance-reports",
    labelKey: "administration.back.finance_berichte",
};

const INVENTORY_HUB: AdministrationBackTarget = {
    path: "/administration/inventory-and-ordering",
    labelKey: "administration.back.inventory",
};

const SERVICES_HUB: AdministrationBackTarget = {
    path: "/administration/services-catalogs-templates",
    labelKey: "administration.back.services",
};

const PRACTICE_HUB: AdministrationBackTarget = {
    path: "/administration/practice-planning",
    labelKey: "administration.back.practicePlanning",
};

const TEAM_HUB: AdministrationBackTarget = {
    path: "/administration/team",
    labelKey: "administration.back.team",
};

const TEMPLATES_LIST: AdministrationBackTarget = { path: "/administration/templates", labelKey: "administration.back.templates" };

/**
 * Resolves the parent screen for the back button: hub → Administration, sub-page → hub, not always `/administration`.
 */
export function getAdministrationBackTarget(pathnameWithOptionalQuery: string): AdministrationBackTarget {
    const raw = (pathnameWithOptionalQuery.split("?")[0] ?? "/").replace(/\/$/, "") || "/";

    if (raw === "/administration") {
        return { path: "/", labelKey: "nav.dashboard" };
    }

    if (raw.startsWith("/administration/templates/editor")) {
        return TEMPLATES_LIST;
    }

    if (raw.startsWith("/administration/finance-reports/") && raw !== "/administration/finance-reports") {
        return FINANCE_BERICHTE;
    }

    const exact: Record<string, AdministrationBackTarget> = {
        "/administration/finance-tools": FINANCE_BERICHTE,
        "/administration/day-close": FINANCE_BERICHTE,
        "/administration/finance-reports": VERWALTUNG,
        "/administration/inventory-and-ordering": VERWALTUNG,
        "/administration/services-catalogs-templates": VERWALTUNG,
        "/administration/practice-planning": VERWALTUNG,
        "/administration/contracts": INVENTORY_HUB,
        "/administration/order-master": INVENTORY_HUB,
        "/administration/treatment-catalog": SERVICES_HUB,
        "/administration/templates": SERVICES_HUB,
        "/administration/work-days": PRACTICE_HUB,
        "/administration/special-blocked-times": PRACTICE_HUB,
        "/administration/work-hours": PRACTICE_HUB,
        "/administration/practice-preferences": PRACTICE_HUB,
        "/services": SERVICES_HUB,
        "/products": INVENTORY_HUB,
        "/staff": TEAM_HUB,
        "/administration/team/work-time": TEAM_HUB,
        "/balance-sheet": FINANCE_BERICHTE,
        "/balance-sheet/new": FINANCE_BERICHTE,
    };

    if (exact[raw]) {
        return exact[raw]!;
    }

    if (raw.startsWith("/staff/") && raw !== "/staff") {
        return TEAM_HUB;
    }

    if (raw.startsWith("/services/")) {
        return SERVICES_HUB;
    }

    return VERWALTUNG;
}
