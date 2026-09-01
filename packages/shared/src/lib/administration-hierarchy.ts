/** One level up within Administration (and top-level Wirtschaft pages opened from a hub). */

export type AdministrationBackTarget = { path: string; labelKey: string };

const ADMINISTRATION: AdministrationBackTarget = { path: "/administration", labelKey: "nav.administration" };

const FINANCE_REPORTS: AdministrationBackTarget = {
    path: "/administration/finance-reports",
    labelKey: "administration.back.finance_reports",
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
        return FINANCE_REPORTS;
    }

    const exact: Record<string, AdministrationBackTarget> = {
        "/administration/finance-tools": FINANCE_REPORTS,
        "/administration/day-close": FINANCE_REPORTS,
        "/administration/finance-reports": ADMINISTRATION,
        "/administration/inventory-and-ordering": ADMINISTRATION,
        "/administration/services-catalogs-templates": ADMINISTRATION,
        "/administration/practice-planning": ADMINISTRATION,
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
        "/balance-sheet": FINANCE_REPORTS,
        "/balance-sheet/new": FINANCE_REPORTS,
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

    return ADMINISTRATION;
}
