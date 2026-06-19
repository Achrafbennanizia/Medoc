/**
 * i18next-backed locale catalogs (NFA-EU-10).
 * Catalogs live in `packages/shared/locales/*.json`.
 */
import { useCallback, useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { de as dateFnsDe } from "date-fns/locale/de";
import { enUS as dateFnsEn } from "date-fns/locale/en-US";
import { fr as dateFnsFr } from "date-fns/locale/fr";
import { arSA as dateFnsAr } from "date-fns/locale/ar-SA";
import type { Locale as DateFnsLocale } from "date-fns";

import deCatalog from "#shared-locales/de.json";
import enCatalog from "#shared-locales/en.json";
import frCatalog from "#shared-locales/fr.json";
import arCatalog from "#shared-locales/ar.json";

export type Locale = "de" | "en" | "fr" | "ar";

const catalogs: Record<Locale, Record<string, string>> = {
    de: deCatalog as Record<string, string>,
    en: enCatalog as Record<string, string>,
    fr: frCatalog as Record<string, string>,
    ar: arCatalog as Record<string, string>,
};

let i18nReady = false;

function ensureI18n() {
    if (i18nReady) return;
    void i18n.use(initReactI18next).init({
        resources: {
            de: { translation: catalogs.de },
            en: { translation: catalogs.en },
            fr: { translation: catalogs.fr },
            ar: { translation: catalogs.ar },
        },
        lng: "de",
        fallbackLng: "de",
        keySeparator: ".",
        interpolation: { escapeValue: false },
        returnEmptyString: false,
    });
    i18nReady = true;
}

ensureI18n();

const localeListeners = new Set<() => void>();

function notifyLocaleListeners() {
    for (const l of localeListeners) l();
}

function subscribeLocale(listener: () => void) {
    localeListeners.add(listener);
    return () => localeListeners.delete(listener);
}

interface LocaleStore {
    locale: Locale;
    setLocale: (l: Locale) => void;
}

export const useLocale = create<LocaleStore>()(
    persist(
        (set) => ({
            locale: "de",
            setLocale: (locale) => {
                ensureI18n();
                void i18n.changeLanguage(locale);
                set({ locale });
                notifyLocaleListeners();
            },
        }),
        {
            name: "medoc-locale",
            onRehydrateStorage: () => (state) => {
                if (state?.locale) {
                    ensureI18n();
                    void i18n.changeLanguage(state.locale);
                    notifyLocaleListeners();
                }
            },
        },
    ),
);

// Sync persisted locale on first load.
if (typeof window !== "undefined") {
    const stored = useLocale.getState().locale;
    ensureI18n();
    void i18n.changeLanguage(stored);
}

export function isRtlLocale(locale: Locale): boolean {
    return locale === "ar";
}

export function dateFnsLocaleFor(locale: Locale): DateFnsLocale {
    switch (locale) {
        case "en":
            return dateFnsEn;
        case "fr":
            return dateFnsFr;
        case "ar":
            return dateFnsAr;
        default:
            return dateFnsDe;
    }
}

/** React hook: date-fns locale matching active UI language. */
export function useDateFnsLocale(): DateFnsLocale {
    const locale = useLocale((s) => s.locale);
    return dateFnsLocaleFor(locale);
}

/** Keys present in the catalog for a locale (CI missing-key guard). */
export function localeCatalogKeys(locale: Locale): string[] {
    return Object.keys(catalogs[locale]);
}

function interpolateParams(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;
    let s = text;
    for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{${k}}`, String(v));
        s = s.replaceAll(`{{${k}}}`, String(v));
    }
    return s;
}

/** Explicit locale (effects, native menu sync). */
export function translateLocale(locale: Locale, key: string): string {
    ensureI18n();
    const t = i18n.getFixedT(locale);
    const v = t(key, { defaultValue: catalogs.de[key] ?? key });
    return v === key && catalogs.de[key] ? catalogs.de[key]! : v;
}

export function translateLocaleWithFallback(locale: Locale, key: string, fallback: string): string {
    const v = translateLocale(locale, key);
    return v === key ? fallback : v;
}

export function translateLocaleParams(
    locale: Locale,
    key: string,
    params: Record<string, string | number>,
): string {
    return interpolateParams(translateLocale(locale, key), params);
}

export function t(key: string): string {
    return translateLocale(useLocale.getState().locale, key);
}

export function useT() {
    const locale = useSyncExternalStore(subscribeLocale, () => useLocale.getState().locale);
    return useCallback((key: string) => translateLocale(locale, key), [locale]);
}

export function useTParams() {
    const locale = useSyncExternalStore(subscribeLocale, () => useLocale.getState().locale);
    return useCallback(
        (key: string, params: Record<string, string | number>) =>
            translateLocaleParams(locale, key, params),
        [locale],
    );
}

/** Initialize i18n for non-React entry points (tests, native menu). */
export function initI18n(locale: Locale = "de") {
    ensureI18n();
    void i18n.changeLanguage(locale);
    useLocale.setState({ locale });
}
/**
 * i18n additions for Wave 3 (string externalization, English origin).
 *
 * MERGE TARGET: packages/shared/src/lib/i18n.ts  (the shared catalog — NOT in this
 * upload, so this file is delivered as a patch to splice in by hand).
 *
 * LANGUAGE MODEL:
 *   - English (`en`) is the ORIGIN / source language and the i18n fallback.
 *   - German (`de`), French (`fr`, optional), Arabic (`ar`, RTL) are TRANSLATION targets.
 *   - Set the catalog's default + fallback locale to `en` (see TRANSLATION-CHANGES.md).
 *
 * HOW TO MERGE:
 *   These are four flat Record<string, string> maps keyed by the dotted i18n key.
 *   Splice each into the matching locale map of your catalog. If your catalog is
 *   shaped { [key]: { en, de, fr, ar } } instead, transpose accordingly.
 *
 * Interpolation: useTParams / tp(key, params) replaces {token}. Tokens used here:
 *   {tooth} {status} {brush} {teeth} {count}
 *
 * SECTION A = NEW keys introduced by the code in this wave (add to all locales).
 * SECTION B = EXISTING keys the refactored code now depends on. Verify they already
 *             exist (en/de almost certainly do); fr/ar values are suggested in case
 *             your fr/ar maps are still being filled in. Do NOT duplicate if present.
 */

/* ───────────────────────── SECTION A — NEW KEYS ───────────────────────── */

export const i18nAdditionsEn: Record<string, string> = {
    // dental chart / picker
    "dental.tooth_aria": "Tooth {tooth}",
    "dental.tooth_status_aria": "Tooth {tooth}, status {status}",
    "dental.chart.view_hint": "View only — enable editing to select a tooth.",
    "dental.chart.pick_hint": "Tap a tooth in the chart — the number is filled into the form.",
    "dental.chart.selected_tooth": "Selected tooth: {tooth}",
    "dental.chart.no_tooth": "No tooth selected",
    "dental.chart.brush_footer": "Brush: {brush} — tap a tooth to apply",
    "dental.chart.brush_footer_tooth": "Tooth {tooth} · Brush: {brush} — tap a tooth to apply",
    "dental.picker.hint": "Multiple teeth allowed: tap to mark (FDI), tap again to deselect.",
    "dental.picker.selected_label": "Selected:",
    "dental.picker.one_tooth": "Tooth {tooth}",
    "dental.picker.many_teeth": "Teeth {teeth}",
    // rbac / access
    "rbac.access_denied_title": "No access",
    "rbac.access_denied_detail": "This area is not enabled for your role.",
    "rbac.to_dashboard": "To dashboard",
    "rbac.route_locked": "This page is locked for your role. Contact the practice management if you need access.",
    "rbac.please_sign_in": "Please sign in.",
    // sync badge
    "sync.badge.label": "Sync",
    "sync.badge.pending_title": "{count} change(s) waiting to sync with the master",
    "sync.badge.up_to_date_title": "Replica sync up to date",
    "sync.badge.pending_short": ": {count} pending",
    "sync.badge.ok_short": ": OK",
    // account menu
    "account.menu_section": "Account",
    "account.menu_role_switch": "Sign in with a different role…",
    // auth
    "auth.password_policy_hint": "Password policy: at least 12 characters, upper/lowercase and a digit.",
    // task workflow step captions
    "praxis.aufgaben.workflow.offen": "Open",
    "praxis.aufgaben.workflow.in_bearbeitung": "In progress",
    "praxis.aufgaben.workflow.erledigt": "Done",
    "praxis.aufgaben.workflow.validiert": "Validated",
};

export const i18nAdditionsDe: Record<string, string> = {
    "dental.tooth_aria": "Zahn {tooth}",
    "dental.tooth_status_aria": "Zahn {tooth}, Status {status}",
    "dental.chart.view_hint": "Ansicht — Bearbeiten aktivieren, um einen Zahn zu wählen.",
    "dental.chart.pick_hint": "Zahn im Chart antippen — die Nummer wird ins Formular übernommen.",
    "dental.chart.selected_tooth": "Ausgewählter Zahn: {tooth}",
    "dental.chart.no_tooth": "Kein Zahn ausgewählt",
    "dental.chart.brush_footer": "Pinsel: {brush} — Zahn antippen zum Setzen",
    "dental.chart.brush_footer_tooth": "Zahn {tooth} · Pinsel: {brush} — Zahn antippen zum Setzen",
    "dental.picker.hint": "Mehrere Zähne möglich: zum Markieren antippen (FDI), erneut tippen zum Abwählen.",
    "dental.picker.selected_label": "Gewählt:",
    "dental.picker.one_tooth": "Zahn {tooth}",
    "dental.picker.many_teeth": "Zähne {teeth}",
    "rbac.access_denied_title": "Kein Zugriff",
    "rbac.access_denied_detail": "Für Ihre Rolle ist dieser Bereich nicht freigegeben.",
    "rbac.to_dashboard": "Zum Dashboard",
    "rbac.route_locked": "Diese Seite ist für Ihre Rolle gesperrt. Wenden Sie sich an die Praxisleitung, wenn Sie Zugriff benötigen.",
    "rbac.please_sign_in": "Bitte melden Sie sich an.",
    "sync.badge.label": "Sync",
    "sync.badge.pending_title": "{count} Änderung(en) warten auf Sync mit dem Master",
    "sync.badge.up_to_date_title": "Replica-Sync aktuell",
    "sync.badge.pending_short": ": {count} ausstehend",
    "sync.badge.ok_short": ": OK",
    "account.menu_section": "Konto",
    "account.menu_role_switch": "Mit anderer Rolle anmelden…",
    "auth.password_policy_hint": "Passwortrichtlinie: mindestens 12 Zeichen, Groß-/Kleinbuchstabe und Ziffer.",
    "praxis.aufgaben.workflow.offen": "Offen",
    "praxis.aufgaben.workflow.in_bearbeitung": "In Bearbeitung",
    "praxis.aufgaben.workflow.erledigt": "Erledigt",
    "praxis.aufgaben.workflow.validiert": "Validiert",
};

export const i18nAdditionsFr: Record<string, string> = {
    "dental.tooth_aria": "Dent {tooth}",
    "dental.tooth_status_aria": "Dent {tooth}, statut {status}",
    "dental.chart.view_hint": "Lecture seule — activez la modification pour sélectionner une dent.",
    "dental.chart.pick_hint": "Touchez une dent dans le schéma — le numéro est inséré dans le formulaire.",
    "dental.chart.selected_tooth": "Dent sélectionnée : {tooth}",
    "dental.chart.no_tooth": "Aucune dent sélectionnée",
    "dental.chart.brush_footer": "Pinceau : {brush} — touchez une dent pour appliquer",
    "dental.chart.brush_footer_tooth": "Dent {tooth} · Pinceau : {brush} — touchez une dent pour appliquer",
    "dental.picker.hint": "Plusieurs dents possibles : touchez pour marquer (FDI), touchez à nouveau pour désélectionner.",
    "dental.picker.selected_label": "Sélection :",
    "dental.picker.one_tooth": "Dent {tooth}",
    "dental.picker.many_teeth": "Dents {teeth}",
    "rbac.access_denied_title": "Accès refusé",
    "rbac.access_denied_detail": "Cette zone n'est pas accessible pour votre rôle.",
    "rbac.to_dashboard": "Vers le tableau de bord",
    "rbac.route_locked": "Cette page est verrouillée pour votre rôle. Contactez la direction du cabinet si vous avez besoin d'un accès.",
    "rbac.please_sign_in": "Veuillez vous connecter.",
    "sync.badge.label": "Sync",
    "sync.badge.pending_title": "{count} modification(s) en attente de synchronisation avec le maître",
    "sync.badge.up_to_date_title": "Synchronisation de la réplique à jour",
    "sync.badge.pending_short": " : {count} en attente",
    "sync.badge.ok_short": " : OK",
    "account.menu_section": "Compte",
    "account.menu_role_switch": "Se connecter avec un autre rôle…",
    "auth.password_policy_hint": "Politique de mot de passe : au moins 12 caractères, majuscule/minuscule et un chiffre.",
    "praxis.aufgaben.workflow.offen": "Ouvert",
    "praxis.aufgaben.workflow.in_bearbeitung": "En cours",
    "praxis.aufgaben.workflow.erledigt": "Terminé",
    "praxis.aufgaben.workflow.validiert": "Validé",
};

export const i18nAdditionsAr: Record<string, string> = {
    "dental.tooth_aria": "السن {tooth}",
    "dental.tooth_status_aria": "السن {tooth}، الحالة {status}",
    "dental.chart.view_hint": "عرض فقط — فعّل التحرير لاختيار سن.",
    "dental.chart.pick_hint": "انقر على سن في المخطط — يُدرج الرقم في النموذج.",
    "dental.chart.selected_tooth": "السن المحدد: {tooth}",
    "dental.chart.no_tooth": "لم يتم اختيار سن",
    "dental.chart.brush_footer": "الفرشاة: {brush} — انقر على سن للتطبيق",
    "dental.chart.brush_footer_tooth": "السن {tooth} · الفرشاة: {brush} — انقر على سن للتطبيق",
    "dental.picker.hint": "يمكن اختيار عدة أسنان: انقر للتحديد (FDI)، وانقر مرة أخرى لإلغاء التحديد.",
    "dental.picker.selected_label": "المحدد:",
    "dental.picker.one_tooth": "السن {tooth}",
    "dental.picker.many_teeth": "الأسنان {teeth}",
    "rbac.access_denied_title": "لا صلاحية وصول",
    "rbac.access_denied_detail": "هذا القسم غير متاح لدورك.",
    "rbac.to_dashboard": "إلى لوحة التحكم",
    "rbac.route_locked": "هذه الصفحة مقفلة لدورك. تواصل مع إدارة العيادة إذا كنت بحاجة إلى الوصول.",
    "rbac.please_sign_in": "يرجى تسجيل الدخول.",
    "sync.badge.label": "مزامنة",
    "sync.badge.pending_title": "{count} تغيير في انتظار المزامنة مع الجهاز الرئيسي",
    "sync.badge.up_to_date_title": "مزامنة النسخة المطابقة محدّثة",
    "sync.badge.pending_short": ": {count} معلّقة",
    "sync.badge.ok_short": ": تمت",
    "account.menu_section": "الحساب",
    "account.menu_role_switch": "تسجيل الدخول بدور آخر…",
    "auth.password_policy_hint": "سياسة كلمة المرور: 12 حرفًا على الأقل، أحرف كبيرة/صغيرة ورقم.",
    "praxis.aufgaben.workflow.offen": "مفتوح",
    "praxis.aufgaben.workflow.in_bearbeitung": "قيد المعالجة",
    "praxis.aufgaben.workflow.erledigt": "منجز",
    "praxis.aufgaben.workflow.validiert": "مُعتمد",
};

/* ──────────── SECTION B — EXISTING KEYS THE CODE NOW RELIES ON ────────────
 * The refactored helpers (aufgabeStatusLabel / aufgabeTypLabel) and the
 * reused common.* / nav.* keys resolve these at runtime. They should already
 * exist in en/de. Verify fr/ar are filled; suggested values below.
 */

export const i18nReliedOnEn: Record<string, string> = {
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.close": "Close",
    "nav.einstellungen": "Settings",
    "account.menu_help": "Help & shortcuts",
    "praxis.aufgaben.status.offen": "Open",
    "praxis.aufgaben.status.in_bearbeitung": "In progress",
    "praxis.aufgaben.status.erledigt_rezeption": "Done (reception)",
    "praxis.aufgaben.status.validiert": "Validated",
    "praxis.aufgaben.status.zurueck": "Returned",
    "praxis.aufgaben.typ.abrechnung": "Billing",
    "praxis.aufgaben.typ.termin": "Appointment",
    "praxis.aufgaben.typ.druck": "Print",
    "praxis.aufgaben.typ.stammdaten": "Master data",
    "praxis.aufgaben.typ.sonstiges": "Other",
};

export const i18nReliedOnDe: Record<string, string> = {
    "common.cancel": "Abbrechen",
    "common.confirm": "Bestätigen",
    "common.close": "Schließen",
    "nav.einstellungen": "Einstellungen",
    "account.menu_help": "Hilfe & Kurzbefehle",
    "praxis.aufgaben.status.offen": "Offen",
    "praxis.aufgaben.status.in_bearbeitung": "In Bearbeitung",
    "praxis.aufgaben.status.erledigt_rezeption": "Erledigt (Rezeption)",
    "praxis.aufgaben.status.validiert": "Validiert",
    "praxis.aufgaben.status.zurueck": "Zurück",
    "praxis.aufgaben.typ.abrechnung": "Abrechnung",
    "praxis.aufgaben.typ.termin": "Termin",
    "praxis.aufgaben.typ.druck": "Druck",
    "praxis.aufgaben.typ.stammdaten": "Stammdaten",
    "praxis.aufgaben.typ.sonstiges": "Sonstiges",
};

export const i18nReliedOnFr: Record<string, string> = {
    "common.cancel": "Annuler",
    "common.confirm": "Confirmer",
    "common.close": "Fermer",
    "nav.einstellungen": "Paramètres",
    "account.menu_help": "Aide et raccourcis",
    "praxis.aufgaben.status.offen": "Ouvert",
    "praxis.aufgaben.status.in_bearbeitung": "En cours",
    "praxis.aufgaben.status.erledigt_rezeption": "Terminé (réception)",
    "praxis.aufgaben.status.validiert": "Validé",
    "praxis.aufgaben.status.zurueck": "Retourné",
    "praxis.aufgaben.typ.abrechnung": "Facturation",
    "praxis.aufgaben.typ.termin": "Rendez-vous",
    "praxis.aufgaben.typ.druck": "Impression",
    "praxis.aufgaben.typ.stammdaten": "Données de base",
    "praxis.aufgaben.typ.sonstiges": "Autre",
};

export const i18nReliedOnAr: Record<string, string> = {
    "common.cancel": "إلغاء",
    "common.confirm": "تأكيد",
    "common.close": "إغلاق",
    "nav.einstellungen": "الإعدادات",
    "account.menu_help": "المساعدة والاختصارات",
    "praxis.aufgaben.status.offen": "مفتوح",
    "praxis.aufgaben.status.in_bearbeitung": "قيد المعالجة",
    "praxis.aufgaben.status.erledigt_rezeption": "منجز (الاستقبال)",
    "praxis.aufgaben.status.validiert": "مُعتمد",
    "praxis.aufgaben.status.zurueck": "مُعاد",
    "praxis.aufgaben.typ.abrechnung": "الفوترة",
    "praxis.aufgaben.typ.termin": "موعد",
    "praxis.aufgaben.typ.druck": "طباعة",
    "praxis.aufgaben.typ.stammdaten": "البيانات الأساسية",
    "praxis.aufgaben.typ.sonstiges": "أخرى",
};