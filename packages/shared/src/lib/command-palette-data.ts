import { routeChildPathAllowed } from "./rbac";

/**
 * Static routes wired to {@link ROUTE_VISIBILITY} keys (must match `App.tsx`).
 */
export type PaletteCommand = {
    id: string;
    routePath: string;
    href: string;
    /** i18n key under palette.cmd.* */
    titleKey: string;
    keywords: string[];
};

function cmd(id: string, routePath: string, href: string, keywords: string[]): PaletteCommand {
    return { id, routePath, href, titleKey: `palette.cmd.${id}`, keywords };
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
    cmd("dash", "", "/", ["home", "start"]),
    cmd("appointments", "appointments", "/appointments", ["calendar", "appointment", "patient_chart", "overview"]),
    cmd("appointments-new", "appointments/new", "/appointments/new", ["create", "appointment new", "booking"]),
    cmd("patients", "patients", "/patients", ["chart", "patient", "patient_chart", "master_data"]),
    cmd("patients-new", "patients/new", "/patients/new", ["create", "new"]),
    cmd("charts-to-validate", "charts/to-validate", "/charts/to-validate", ["validation", "chart", "physician", "draft", "fa-chart-15"]),
    cmd("practice-tickets", "tickets", "/tickets", ["ticket", "reception", "physician", "message", "fa-pers-08"]),
    cmd("finance", "finance", "/finance", ["money", "cash"]),
    cmd("finance-cash", "finance/cash", "/finance/cash", ["cash", "reception", "payment", "day_close"]),
    cmd("finance-new", "finance/new", "/finance/new", ["create", "booking", "cash", "payment"]),
    cmd("finance-cash-new", "finance/cash/new", "/finance/cash/new", ["create", "cash", "payment", "reception"]),
    cmd("purchase-orders", "purchase-orders", "/purchase-orders", ["delivery", "goods", "purchasing"]),
    cmd("purchase-orders-new", "purchase-orders/new", "/purchase-orders/new", ["create", "supplier", "purchase order new"]),
    cmd("balance-sheet", "balance-sheet", "/balance-sheet", ["accounting"]),
    cmd("balance-sheet-new", "balance-sheet/new", "/balance-sheet/new", ["wizard", "new", "balance-sheet"]),
    cmd("administration", "administration", "/administration", ["admin", "settings practice"]),
    cmd("administration-workDays", "administration/work-days", "/administration/work-days", ["calendar", "absence", "vacation"]),
    cmd("administration-practicePlanning", "administration/practice-planning", "/administration/practice-planning", ["holidays", "workTime", "preferences"]),
    cmd("administration-work_hours", "administration/work-hours", "/administration/work-hours", ["opening hours", "break", "slot duration"]),
    cmd("administration-special-blockedTimes", "administration/special-blocked-times", "/administration/special-blocked-times", ["closure", "half-day", "emergency", "block"]),
    cmd("administration-preferences", "administration/practice-preferences", "/administration/practice-preferences", ["appointment_rules", "reminder", "noshow"]),
    cmd("administration-templates", "administration/templates", "/administration/templates", ["template", "medication", "certificate"]),
    cmd("administration-templates-editor", "administration/templates/editor", "/administration/templates/editor", ["template", "editor", "prescription", "certificate", "edit"]),
    cmd("administration-treatment-catalog", "administration/treatment-catalog", "/administration/treatment-catalog", ["treatment", "catalog", "service_item", "category"]),
    cmd("administration-order_master", "administration/order-master", "/administration/order-master", ["supplier", "pharma_consultant", "purchase_order", "master"]),
    cmd("administration-finance-reports", "administration/finance-reports", "/administration/finance-reports", ["balance-sheet", "invoice", "day_close", "reports"]),
    cmd("administration-team", "administration/team", "/administration/team", ["staff", "employees", "work_plan", "shifts", "plan"]),
    cmd("administration-inventory-ordering", "administration/inventory-and-ordering", "/administration/inventory-and-ordering", ["product", "inventory", "supplier", "order_master", "material"]),
    cmd("administration-contracts", "administration/contracts", "/administration/contracts", ["rent", "insurance", "contract", "recurring", "lab"]),
    cmd("administration-services-catalogs-templates", "administration/services-catalogs-templates", "/administration/services-catalogs-templates", ["goz", "treatment catalog", "prescription", "certificate", "template", "service_item"]),
    cmd("administration-day_close", "administration/finance-reports/day-close", "/administration/finance-reports/day-close", ["cash", "cash-up", "day_close"]),
    cmd("administration-finance-tools", "administration/finance-reports/invoice", "/administration/finance-reports/invoice", ["invoice", "pdf"]),
    cmd("prescriptions", "prescriptions", "/prescriptions", ["medication"]),
    cmd("certificates", "certificates", "/certificates", ["certificate", "sick leave"]),
    cmd("services", "services", "/services", ["goz", "fee"]),
    cmd("services-new", "services", "/services?new=1", ["create"]),
    cmd("products", "products", "/products", ["material", "inventory"]),
    cmd("staff", "staff", "/staff", ["team", "staff"]),
    cmd("staff-work_plan", "staff/work-plan", "/staff/work-plan", ["shift", "duty", "week", "plan"]),
    cmd("staff-workTime", "staff/work-time", "/staff/work-time", ["time", "clock-in", "break", "shift"]),
    cmd("administration-team-workTime", "administration/team/work-time", "/administration/team/work-time", ["staff", "overview", "hours", "team"]),
    cmd("staff-new", "staff/new", "/staff/new", ["create"]),
    cmd("statistics", "statistics", "/statistics", ["metrics", "report"]),
    cmd("audit", "audit", "/audit", ["protocol", "traceability"]),
    cmd("privacy", "privacy", "/privacy", ["privacy", "dsgvo"]),
    cmd("settings", "settings", "/settings", ["account", "profile"]),
    cmd("logs", "logs", "/logs", ["debug", "error"]),
    cmd("ops", "ops", "/ops", ["backup", "migration"]),
    cmd("compliance", "compliance", "/compliance", ["policies"]),
    cmd("help", "help", "/help", ["help", "shortcuts", "keyboard"]),
    cmd("feedback", "feedback", "/feedback", ["report", "notice", "safety"]),
    cmd("migration", "migration", "/migration", ["import", "move", "wizard"]),
];

export function filterCommandsForRole(
    role: string | undefined,
    overrides?: import("@/models/types").PermissionOverride[] | null,
): PaletteCommand[] {
    return PALETTE_COMMANDS.filter((c) => routeChildPathAllowed(c.routePath, role, overrides));
}

export function filterCommandsForFocusMode(commands: PaletteCommand[]): PaletteCommand[] {
    const allowed = new Set(["", "staff/work-time", "settings"]);
    return commands.filter((c) => allowed.has(c.routePath));
}
