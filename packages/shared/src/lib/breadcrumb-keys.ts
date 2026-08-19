/** i18n key paths for app breadcrumbs (segments after breadcrumb.app / nav.* / palette.cmd.*). */

const APP = "breadcrumb.app";

export function breadcrumbKeysForPath(pathname: string): string[] {
    if (pathname === "/appointments/new") return [APP, "nav.appointments", "palette.cmd.appointments-new"];
    if (pathname === "/finance/cash") return [APP, "nav.finance_reception"];
    if (pathname === "/finance/cash/new") return [APP, "nav.finance_reception", "palette.cmd.finance-new"];
    if (pathname === "/finance/new") return [APP, "nav.finance", "palette.cmd.finance-new"];
    if (pathname === "/purchase-orders/new") return [APP, "nav.purchase-orders", "palette.cmd.purchase-orders-new"];
    if (pathname === "/patients/new") return [APP, "nav.patients", "palette.cmd.patients-new"];
    if (pathname === "/balance-sheet/new") return [APP, "nav.balance-sheet", "palette.cmd.balance-sheet-new"];
    if (pathname === "/charts/to-validate") return [APP, "nav.patients", "nav.charts_to_validate"];
    if (pathname === "/inbox") return [APP, "nav.inbox"];
    if (pathname === "/tickets") return [APP, "nav.practice_tickets"];
    if (pathname === "/tickets/new") return [APP, "nav.practice_tickets", "breadcrumb.new_task"];
    if (/^\/tickets\/[^/]+\/bearbeiten$/.test(pathname)) return [APP, "nav.practice_tickets", "breadcrumb.edit"];
    if (pathname === "/administration") return [APP, "nav.administration"];
    if (pathname === "/administration/work-days") return [APP, "nav.administration", "breadcrumb.work_days"];
    if (pathname === "/administration/practice-planning") return [APP, "nav.administration", "palette.cmd.administration-practicePlanning"];
    if (pathname === "/administration/work-hours") return [APP, "nav.administration", "palette.cmd.administration-work_hours"];
    if (pathname === "/administration/special-blocked-times") return [APP, "nav.administration", "palette.cmd.administration-special-blockedTimes"];
    if (pathname === "/administration/practice-preferences") return [APP, "nav.administration", "palette.cmd.administration-preferences"];
    if (pathname === "/administration/templates") return [APP, "nav.administration", "breadcrumb.templates"];
    if (pathname === "/administration/treatment-catalog") return [APP, "nav.administration", "breadcrumb.treatment_catalog"];
    if (pathname === "/administration/order-master") return [APP, "nav.administration", "breadcrumb.order_master"];
    if (pathname === "/administration/finance-reports") return [APP, "nav.administration", "breadcrumb.finance_reports"];
    if (pathname === "/administration/team") return [APP, "nav.administration", "breadcrumb.team"];
    if (pathname === "/administration/team/work-time") return [APP, "nav.administration", "breadcrumb.team", "breadcrumb.work_time"];
    if (pathname === "/staff/work-time") return [APP, "nav.workTime"];
    if (pathname === "/administration/sick-leave-certificate") return [APP, "nav.administration", "breadcrumb.sick_cert"];
    if (pathname === "/administration/finance-reports/day-close") {
        return [APP, "nav.administration", "breadcrumb.finance_reports", "breadcrumb.daily_close"];
    }
    if (pathname === "/administration/finance-reports/invoice") {
        return [APP, "nav.administration", "breadcrumb.finance_reports", "breadcrumb.invoice_pdf"];
    }
    if (pathname === "/administration/inventory-and-ordering") return [APP, "nav.administration", "breadcrumb.stock_orders"];
    if (pathname === "/administration/contracts") return [APP, "nav.administration", "breadcrumb.stock_orders", "breadcrumb.contracts"];
    if (pathname === "/administration/services-catalogs-templates") {
        return [APP, "nav.administration", "breadcrumb.services_catalogs"];
    }
    if (pathname === "/administration/finance-tools") return [APP, "nav.administration", "breadcrumb.finance_reports", "breadcrumb.invoice_pdf"];
    if (pathname === "/administration/day-close") return [APP, "nav.administration", "breadcrumb.finance_reports", "breadcrumb.daily_close"];
    if (pathname.startsWith("/administration/templates/editor")) return [APP, "nav.administration", "breadcrumb.templates", "breadcrumb.editor"];
    if (pathname === "/staff/new") return [APP, "nav.administration", "palette.cmd.staff-new"];
    if (pathname === "/staff/work-plan") return [APP, "nav.administration", "nav.staff", "breadcrumb.shift_plan"];
    if (pathname.startsWith("/patients/") && pathname !== "/patients/new") {
        if (/\/prescription\/new$/.test(pathname)) {
            return [APP, "nav.patients", "breadcrumb.record", "breadcrumb.new_prescription"];
        }
        if (/\/prescription\//.test(pathname) && !/\/prescription\/new$/.test(pathname)) {
            return [APP, "nav.patients", "breadcrumb.record", "breadcrumb.edit_prescription"];
        }
        return [APP, "nav.patients", "breadcrumb.record"];
    }
    return CRUMB_KEYS[pathname] ?? [APP, "breadcrumb.dashboard"];
}

const CRUMB_KEYS: Record<string, string[]> = {
    "/": [APP, "nav.dashboard"],
    "/appointments": [APP, "nav.appointments"],
    "/patients": [APP, "nav.patients"],
    "/finance": [APP, "nav.finance"],
    "/purchase-orders": [APP, "nav.purchase-orders"],
    "/balance-sheet": [APP, "nav.balance-sheet"],
    "/prescriptions": [APP, "nav.prescriptions"],
    "/certificates": [APP, "nav.certificates"],
    "/services": [APP, "nav.services"],
    "/products": [APP, "nav.products"],
    "/staff": [APP, "nav.administration", "breadcrumb.team", "nav.staff"],
    "/statistics": [APP, "nav.statistics"],
    "/audit": [APP, "nav.audit"],
    "/privacy": [APP, "nav.privacy"],
    "/settings": [APP, "nav.settings"],
    "/logs": [APP, "nav.logs"],
    "/ops": [APP, "nav.ops"],
    "/compliance": [APP, "nav.compliance"],
    "/help": [APP, "nav.help"],
    "/feedback": [APP, "nav.feedback"],
    "/migration": [APP, "nav.migration"],
};
