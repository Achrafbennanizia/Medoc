import type { AdministrationTocHubDef, AdministrationTocHubId } from "./types";

/** Team hub — simple section/description rows (no icon column), same as Finance. */
const TEAM_HUB: AdministrationTocHubDef = {
    id: "team",
    titleKey: "page.administration_team.title",
    subtitleKey: "administration.team.subtitle",
    items: [
        {
            titleKey: "page.administration_team.link_staff_title",
            descKey: "page.administration_team.link_staff_desc",
            href: "/staff",
            requires: "staff",
        },
        {
            titleKey: "page.administration_team.link_work_plan_title",
            descKey: "page.administration_team.link_work_plan_desc",
            href: "/staff/work-plan",
            requires: "staff/work-plan",
        },
        {
            titleKey: "page.administration_team.link_team_work_time_title",
            descKey: "page.administration_team.link_team_work_time_desc",
            href: "/administration/team/work-time",
            requires: "administration/team/work-time",
        },
    ],
};

const FINANCE_REPORTS_HUB: AdministrationTocHubDef = {
    id: "finance-reports",
    titleKey: "page.administration_finance.title",
    subtitleKey: "administration.finance.subtitle",
    items: [
        {
            titleKey: "page.administration_finance.link_day_close_title",
            descKey: "page.administration_finance.link_day_close_desc",
            href: "/administration/finance-reports/day-close",
            requires: "administration/finance-reports/day-close",
        },
        {
            titleKey: "page.administration_finance.link_invoice_title",
            descKey: "page.administration_finance.link_invoice_desc",
            href: "/administration/finance-reports/invoice",
            requires: "administration/finance-reports/invoice",
        },
        {
            titleKey: "page.administration_finance.link_balance_sheets_title",
            descKey: "page.administration_finance.link_balance_sheets_desc",
            href: "/balance-sheet",
            requires: "balance-sheet",
        },
    ],
};

const INVENTORY_HUB: AdministrationTocHubDef = {
    id: "inventory",
    titleKey: "page.administration_inventory.title",
    subtitleKey: "administration.inventory.subtitle",
    items: [
        {
            titleKey: "page.administration_inventory.link_products_title",
            descKey: "page.administration_inventory.link_products_desc",
            href: "/products",
            requires: "products",
            featureFlag: "productsMenu",
        },
        {
            titleKey: "page.administration_inventory.link_order_master_title",
            descKey: "page.administration_inventory.link_order_master_desc",
            href: "/administration/order-master",
            requires: "administration/order-master",
        },
        {
            titleKey: "page.administration_inventory.link_contracts_title",
            descKey: "page.administration_inventory.link_contracts_desc",
            href: "/administration/contracts",
            requires: "administration/contracts",
        },
    ],
};

const SERVICES_HUB: AdministrationTocHubDef = {
    id: "services",
    titleKey: "page.administration_services.title",
    subtitleKey: "administration.services.subtitle",
    items: [
        {
            titleKey: "page.administration_services.link_services_title",
            descKey: "page.administration_services.link_services_desc",
            href: "/services",
            requires: "services",
            featureFlag: "servicesMenu",
        },
        {
            titleKey: "page.administration_services.link_treatment_title",
            descKey: "page.administration_services.link_treatment_desc",
            href: "/administration/treatment-catalog",
            requires: "administration/treatment-catalog",
        },
        {
            titleKey: "page.administration_services.link_templates_title",
            descKey: "page.administration_services.link_templates_desc",
            href: "/administration/templates",
            requires: "administration/templates",
            featureFlag: "prescriptionsCertificatesMenu",
        },
    ],
};

const PRACTICE_PLANNING_HUB: AdministrationTocHubDef = {
    id: "practicePlanning",
    titleKey: "page.practicePlanning.title",
    subtitleKey: "page.practicePlanning.subtitle",
    items: [
        {
            titleKey: "page.practicePlanning.link_work_days_title",
            descKey: "page.practicePlanning.link_work_days_desc",
            href: "/administration/work-days",
            requires: "administration/work-days",
        },
        {
            titleKey: "page.practicePlanning.link_blocked_times_title",
            descKey: "page.practicePlanning.link_blocked_times_desc",
            href: "/administration/special-blocked-times",
            requires: "administration/special-blocked-times",
        },
        {
            titleKey: "page.practicePlanning.link_work_hours_title",
            descKey: "page.practicePlanning.link_work_hours_desc",
            href: "/administration/work-hours",
            requires: "administration/work-hours",
        },
        {
            titleKey: "page.practicePlanning.link_preferences_title",
            descKey: "page.practicePlanning.link_preferences_desc",
            href: "/administration/practice-preferences",
            requires: "administration/practice-preferences",
        },
    ],
};

/** Top-level Administration menu — icon column for hub categories. */
const ROOT_HUB: AdministrationTocHubDef = {
    id: "root",
    titleKey: "page.administration.title",
    subtitleKey: "page.administration.subtitle",
    items: [
        {
            titleKey: "page.administration.link_team_title",
            descKey: "page.administration.link_team_desc",
            href: "/administration/team",
            iconKey: "/staff",
            requires: "administration/team",
        },
        {
            titleKey: "page.administration.link_finance_title",
            descKey: "page.administration.link_finance_desc",
            href: "/administration/finance-reports",
            iconKey: "/finance",
            requires: "administration/finance-reports",
        },
        {
            titleKey: "page.administration.link_inventory_title",
            descKey: "page.administration.link_inventory_desc",
            href: "/administration/inventory-and-ordering",
            iconKey: "/products",
            requires: "administration/inventory-and-ordering",
        },
        {
            titleKey: "page.administration.link_services_title",
            descKey: "page.administration.link_services_desc",
            href: "/administration/services-catalogs-templates",
            iconKey: "/services",
            requires: "administration/services-catalogs-templates",
        },
        {
            titleKey: "page.administration.link_practice_title",
            descKey: "page.administration.link_practice_desc",
            href: "/administration/practice-planning",
            iconKey: "/appointments",
            requires: "administration/practice-planning",
        },
    ],
};

export const ADMINISTRATION_TOC_HUBS: Record<AdministrationTocHubId, AdministrationTocHubDef> = {
    root: ROOT_HUB,
    team: TEAM_HUB,
    "finance-reports": FINANCE_REPORTS_HUB,
    inventory: INVENTORY_HUB,
    services: SERVICES_HUB,
    practicePlanning: PRACTICE_PLANNING_HUB,
};

export function getAdministrationTocHubDef(hubId: AdministrationTocHubId): AdministrationTocHubDef {
    return ADMINISTRATION_TOC_HUBS[hubId];
}
