// Lightweight in-house i18n (NFA-EU-10).
//
// Avoids pulling in i18next/react-i18next; the dictionary is a flat record
// of dot-separated keys per locale. Locale choice is persisted in
// localStorage and exposed via the `useLocale` hook.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "de" | "en";

const dict: Record<Locale, Record<string, string>> = {
    de: {
        "app.title": "MeDoc — Praxisverwaltung",
        "nav.dashboard": "Dashboard",
        "nav.termine": "Termine",
        "nav.patienten": "Patienten",
        "nav.finanzen": "Finanzen",
        "nav.leistungen": "Leistungen",
        "nav.produkte": "Produkte",
        "nav.personal": "Personal",
        "nav.statistik": "Statistik",
        "nav.audit": "Audit-Log",
        "nav.logs": "Logs",
        "nav.ops": "Betrieb",
        "nav.compliance": "Compliance",
        "nav.bilanz": "Bilanz",
        "nav.rezepte": "Rezepte",
        "nav.atteste": "Atteste",
        "nav.datenschutz": "Datenschutz",
        "nav.einstellungen": "Einstellungen",
        "common.save": "Speichern",
        "common.cancel": "Abbrechen",
        "common.delete": "Löschen",
        "common.confirm": "Bestätigen",
        "common.loading": "Wird geladen…",
        "common.error": "Fehler",
        "auth.login": "Anmelden",
        "auth.logout": "Abmelden",
        "auth.email": "E-Mail",
        "auth.password": "Passwort",
        "auth.session_expired": "Sitzung abgelaufen — bitte erneut anmelden.",
        "ops.backup": "Backup",
        "ops.import": "Import",
        "logs.level": "Log-Level",
        "logs.export": "Logs exportieren",
        "logs.audit_chain": "Audit-Kette",
        "a11y.skip_to_main": "Zum Hauptinhalt springen",
        "a11y.close_dialog": "Dialog schließen",
        "a11y.notifications_region": "Benachrichtigungen",
        "a11y.dismiss_notification": "Benachrichtigung schließen",
    },
    en: {
        "app.title": "MeDoc — Practice Management",
        "nav.dashboard": "Dashboard",
        "nav.termine": "Appointments",
        "nav.patienten": "Patients",
        "nav.finanzen": "Finance",
        "nav.leistungen": "Services",
        "nav.produkte": "Inventory",
        "nav.personal": "Staff",
        "nav.statistik": "Statistics",
        "nav.audit": "Audit Log",
        "nav.logs": "Logs",
        "nav.ops": "Operations",
        "nav.compliance": "Compliance",
        "nav.bilanz": "Balance",
        "nav.rezepte": "Prescriptions",
        "nav.atteste": "Certificates",
        "nav.datenschutz": "Privacy",
        "nav.einstellungen": "Settings",
        "common.save": "Save",
        "common.cancel": "Cancel",
        "common.delete": "Delete",
        "common.confirm": "Confirm",
        "common.loading": "Loading…",
        "common.error": "Error",
        "auth.login": "Sign in",
        "auth.logout": "Sign out",
        "auth.email": "Email",
        "auth.password": "Password",
        "auth.session_expired": "Session expired — please sign in again.",
        "ops.backup": "Backup",
        "ops.import": "Import",
        "logs.level": "Log level",
        "logs.export": "Export logs",
        "logs.audit_chain": "Audit chain",
        "a11y.skip_to_main": "Skip to main content",
        "a11y.close_dialog": "Close dialog",
        "a11y.notifications_region": "Notifications",
        "a11y.dismiss_notification": "Dismiss notification",
    },
};

interface LocaleStore {
    locale: Locale;
    setLocale: (l: Locale) => void;
}

export const useLocale = create<LocaleStore>()(
    persist(
        (set) => ({
            locale: "de",
            setLocale: (locale) => set({ locale }),
        }),
        { name: "medoc-locale" },
    ),
);

/// Translate a key for the current locale, falling back to the key itself.
export function t(key: string): string {
    const { locale } = useLocale.getState();
    return dict[locale][key] ?? dict.de[key] ?? key;
}

/// React hook variant for components that need to re-render on locale change.
export function useT() {
    const locale = useLocale((s) => s.locale);
    return (key: string) => dict[locale][key] ?? dict.de[key] ?? key;
}
