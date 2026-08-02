/** i18n key paths for app breadcrumbs (segments after breadcrumb.app / nav.* / palette.cmd.*). */

const APP = "breadcrumb.app";

export function breadcrumbKeysForPath(pathname: string): string[] {
    if (pathname === "/termine/neu") return [APP, "nav.termine", "palette.cmd.termine-neu"];
    if (pathname === "/finanzen/kasse") return [APP, "nav.finanzen_reception"];
    if (pathname === "/finanzen/kasse/neu") return [APP, "nav.finanzen_reception", "palette.cmd.finanzen-neu"];
    if (pathname === "/finanzen/neu") return [APP, "nav.finanzen", "palette.cmd.finanzen-neu"];
    if (pathname === "/bestellungen/neu") return [APP, "nav.bestellungen", "palette.cmd.bestellungen-neu"];
    if (pathname === "/patienten/neu") return [APP, "nav.patienten", "palette.cmd.patienten-neu"];
    if (pathname === "/bilanz/neu") return [APP, "nav.bilanz", "palette.cmd.bilanz-neu"];
    if (pathname === "/akten/zu-validieren") return [APP, "nav.patienten", "nav.akten_zu_validieren"];
    if (pathname === "/posteingang") return [APP, "nav.posteingang"];
    if (pathname === "/tickets") return [APP, "nav.praxis_tickets"];
    if (pathname === "/tickets/neu") return [APP, "nav.praxis_tickets", "breadcrumb.new_task"];
    if (/^\/tickets\/[^/]+\/bearbeiten$/.test(pathname)) return [APP, "nav.praxis_tickets", "breadcrumb.edit"];
    if (pathname === "/verwaltung") return [APP, "nav.verwaltung"];
    if (pathname === "/verwaltung/arbeitstage") return [APP, "nav.verwaltung", "breadcrumb.work_days"];
    if (pathname === "/verwaltung/praxisplanung") return [APP, "nav.verwaltung", "palette.cmd.verwaltung-praxisplanung"];
    if (pathname === "/verwaltung/arbeitszeiten") return [APP, "nav.verwaltung", "palette.cmd.verwaltung-arbeitszeiten"];
    if (pathname === "/verwaltung/sonder-sperrzeiten") return [APP, "nav.verwaltung", "palette.cmd.verwaltung-sonder-sperrzeiten"];
    if (pathname === "/verwaltung/praxis-praeferenzen") return [APP, "nav.verwaltung", "palette.cmd.verwaltung-praeferenzen"];
    if (pathname === "/verwaltung/vorlagen") return [APP, "nav.verwaltung", "breadcrumb.templates"];
    if (pathname === "/verwaltung/behandlungs-katalog") return [APP, "nav.verwaltung", "breadcrumb.treatment_catalog"];
    if (pathname === "/verwaltung/bestellstamm") return [APP, "nav.verwaltung", "breadcrumb.order_master"];
    if (pathname === "/verwaltung/finanzen-berichte") return [APP, "nav.verwaltung", "breadcrumb.finance_reports"];
    if (pathname === "/verwaltung/team") return [APP, "nav.verwaltung", "breadcrumb.team"];
    if (pathname === "/verwaltung/team/arbeitszeit") return [APP, "nav.verwaltung", "breadcrumb.team", "breadcrumb.work_time"];
    if (pathname === "/personal/arbeitszeit") return [APP, "nav.arbeitszeit"];
    if (pathname === "/verwaltung/krankenbescheinigung") return [APP, "nav.verwaltung", "breadcrumb.sick_cert"];
    if (pathname === "/verwaltung/finanzen-berichte/tagesabschluss") {
        return [APP, "nav.verwaltung", "breadcrumb.finance_reports", "breadcrumb.daily_close"];
    }
    if (pathname === "/verwaltung/finanzen-berichte/rechnung") {
        return [APP, "nav.verwaltung", "breadcrumb.finance_reports", "breadcrumb.invoice_pdf"];
    }
    if (pathname === "/verwaltung/lager-und-bestellwesen") return [APP, "nav.verwaltung", "breadcrumb.stock_orders"];
    if (pathname === "/verwaltung/vertraege") return [APP, "nav.verwaltung", "breadcrumb.stock_orders", "breadcrumb.contracts"];
    if (pathname === "/verwaltung/leistungen-kataloge-vorlagen") {
        return [APP, "nav.verwaltung", "breadcrumb.services_catalogs"];
    }
    if (pathname === "/verwaltung/finanzen-werkzeuge") return [APP, "nav.verwaltung", "breadcrumb.finance_reports", "breadcrumb.invoice_pdf"];
    if (pathname === "/verwaltung/tagesabschluss") return [APP, "nav.verwaltung", "breadcrumb.finance_reports", "breadcrumb.daily_close"];
    if (pathname.startsWith("/verwaltung/vorlagen/editor")) return [APP, "nav.verwaltung", "breadcrumb.templates", "breadcrumb.editor"];
    if (pathname === "/personal/neu") return [APP, "nav.verwaltung", "palette.cmd.personal-neu"];
    if (pathname === "/personal/arbeitsplan") return [APP, "nav.verwaltung", "nav.personal", "breadcrumb.shift_plan"];
    if (pathname.startsWith("/patienten/") && pathname !== "/patienten/neu") {
        if (/\/rezept\/neu$/.test(pathname)) {
            return [APP, "nav.patienten", "breadcrumb.record", "breadcrumb.new_prescription"];
        }
        if (/\/rezept\//.test(pathname) && !/\/rezept\/neu$/.test(pathname)) {
            return [APP, "nav.patienten", "breadcrumb.record", "breadcrumb.edit_prescription"];
        }
        return [APP, "nav.patienten", "breadcrumb.record"];
    }
    return CRUMB_KEYS[pathname] ?? [APP, "breadcrumb.dashboard"];
}

const CRUMB_KEYS: Record<string, string[]> = {
    "/": [APP, "nav.dashboard"],
    "/termine": [APP, "nav.termine"],
    "/patienten": [APP, "nav.patienten"],
    "/finanzen": [APP, "nav.finanzen"],
    "/bestellungen": [APP, "nav.bestellungen"],
    "/bilanz": [APP, "nav.bilanz"],
    "/rezepte": [APP, "nav.rezepte"],
    "/atteste": [APP, "nav.atteste"],
    "/leistungen": [APP, "nav.leistungen"],
    "/produkte": [APP, "nav.produkte"],
    "/personal": [APP, "nav.verwaltung", "breadcrumb.team", "nav.personal"],
    "/statistik": [APP, "nav.statistik"],
    "/audit": [APP, "nav.audit"],
    "/datenschutz": [APP, "nav.datenschutz"],
    "/einstellungen": [APP, "nav.settings"],
    "/logs": [APP, "nav.logs"],
    "/ops": [APP, "nav.ops"],
    "/compliance": [APP, "nav.compliance"],
    "/hilfe": [APP, "nav.hilfe"],
    "/feedback": [APP, "nav.feedback"],
    "/migration": [APP, "nav.migration"],
};
