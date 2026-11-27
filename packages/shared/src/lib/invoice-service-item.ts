import { errorMessage } from "@/lib/utils";
import { roundMoney2 } from "@/lib/payment-booking";
import {
    DEFAULT_PRACTICE_HEADER_PRIVACY,
    loadPracticeHeaderPrivacy,
    maskPracticeExportToken,
    type PracticeHeaderPrivacyV1,
} from "@/lib/practice-header-privacy";
import { isolateLtrPhone } from "@/lib/arabic-numerals";

import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";
import { t } from "@/lib/i18n";
import { normalizePracticeCurrency, publishPracticeCurrency } from "@/lib/practice-currency";

const LS_INVOICE_PRACTICE = "medoc-invoice-practice-v1";
const INVOICE_PRACTICE_KV_KEY = "invoice.practice.v1" as const;

export type InvoicePractice = {
    name: string;
    addr: string;
    /** Statutory health insurance (KV) number — for labels & master data */
    kv_number?: string;
    /** Free-text opening hours */
    opening_hours?: string;
    phone?: string;
    fax?: string;
    email?: string;
    /** Practice website (shown in PDF without https:// if desired) */
    web?: string;
    tax_number?: string;
    /** ISO 4217 code. Empty or unknown values display as EUR. */
    currency?: string;
    vat_id?: string;
    /** e.g. "Dr. Jane Smith" */
    clinician_name?: string;
    /** Dentist title label */
    professional_title?: string;
    /** Dentist number (9 digits) */
    zanr?: string;
    /** Practice site number (9 digits) */
    bsnr?: string;
    /** LANR when it differs from ZANR */
    lanr?: string;
    bank_iban?: string;
    bank_bic?: string;
    bank_name?: string;
    account_holder?: string;
    /** Regional dental chamber label */
    chamber?: string;
    /** "KZV …" */
    kzv?: string;
    /** Standard 14 days */
    payment_terms_days?: number;
    /** e.g. VAT-exempt under § 4 No. 14 UStG (DE legal text may stay in value) */
    vat_exemption_notice?: string;
    emergency_phone?: string;
    /** Country whose law documents cite: "MA" | "DE" | "FR" | "EU"; empty = from currency/language. */
    country?: string;
    /** Morocco (CGI art. 145): ICE, IF, TP, RC, CNSS, INPE — printed when currency is MAD. */
    ma_ice?: string;
    ma_if?: string;
    ma_tp?: string;
    ma_rc?: string;
    ma_cnss?: string;
    ma_inpe?: string;
    /** France: RPPS number of the dentist (11 digits), printed on prescriptions. */
    fr_rpps?: string;
    /** France: SIRET of the practice (14 digits). */
    fr_siret?: string;
};

function defaultVatNotice(): string {
    return t("settings.practice.vat_exemption_default");
}

function emptyInvoicePractice(): InvoicePractice {
    return { ...DEFAULTS, vat_exemption_notice: defaultVatNotice() };
}

const DEFAULTS: InvoicePractice = {
    name: "Dental practice",
    addr: "Sample Street 1\n12345 City",
    payment_terms_days: 14,
};

const INVOICE_PRACTICE_OPTIONAL_STRING_KEYS = [
    "kv_number",
    "opening_hours",
    "phone",
    "fax",
    "email",
    "web",
    "tax_number",
    "vat_id",
    "clinician_name",
    "professional_title",
    "zanr",
    "bsnr",
    "lanr",
    "bank_iban",
    "bank_bic",
    "bank_name",
    "account_holder",
    "chamber",
    "kzv",
    "vat_exemption_notice",
    "emergency_phone",
    "country",
    "ma_ice",
    "ma_if",
    "ma_tp",
    "ma_rc",
    "ma_cnss",
    "ma_inpe",
    "fr_rpps",
    "fr_siret",
] as const;

type InvoicePracticeJson = Record<string, unknown>;

function optStr(s: string | undefined): string | undefined {
    const t = (s ?? "").trim();
    return t || undefined;
}

function jsonStr(j: InvoicePracticeJson, key: string): string | undefined {
    const v = j[key];
    return typeof v === "string" ? optStr(v) : undefined;
}

function jsonNum(j: InvoicePracticeJson, key: string): number | undefined {
    const v = j[key];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function parseInvoicePracticeJson(j: InvoicePracticeJson): InvoicePractice {
    const name = jsonStr(j, "name") || DEFAULTS.name;
    const addr = jsonStr(j, "addr") || DEFAULTS.addr;
    const out: InvoicePractice = { name, addr, currency: normalizePracticeCurrency(jsonStr(j, "currency")) };
    for (const key of INVOICE_PRACTICE_OPTIONAL_STRING_KEYS) {
        const version = jsonStr(j, key);
        if (version) (out as Record<string, string | number | undefined>)[key] = version;
    }
    const zt = jsonNum(j, "payment_terms_days");
    if (zt != null && zt > 0) {
        out.payment_terms_days = Math.round(zt);
    } else if (out.payment_terms_days == null) {
        out.payment_terms_days = DEFAULTS.payment_terms_days;
    }
    if (!out.vat_exemption_notice?.trim()) {
        out.vat_exemption_notice = defaultVatNotice();
    }
    return out;
}

function invoicePracticeToBlob(p: InvoicePractice): Record<string, string | number> {
    const blob: Record<string, string | number> = {
        name: p.name.trim() || DEFAULTS.name,
        addr: p.addr.trim() || DEFAULTS.addr,
        currency: normalizePracticeCurrency(p.currency),
    };
    for (const key of INVOICE_PRACTICE_OPTIONAL_STRING_KEYS) {
        const t = optStr(p[key]);
        if (t) blob[key] = t;
    }
    const zt = p.payment_terms_days ?? DEFAULTS.payment_terms_days;
    if (zt != null && Number.isFinite(zt) && zt > 0) blob.payment_terms_days = Math.round(zt);
    return blob;
}

/**
 * Lines for practice header in PDF (`practice_address`): address, then contact and mandatory fields.
 * Order follows typical invoice/letterhead layout.
 *
 * @param show — per field `true` = plaintext, `false` = masked (as in Settings › Practice).
 */
export function buildInvoiceHeaderAddressLines(p: InvoicePractice, show: PracticeHeaderPrivacyV1 = DEFAULT_PRACTICE_HEADER_PRIVACY): string[] {
    const lines: string[] = [];
    for (const raw of (p.addr ?? "").split(/\r?\n/)) {
        const t = raw.trim();
        if (t) lines.push(t);
    }
    const tel = (p.phone ?? "").trim();
    if (tel) lines.push(`Tel. ${show.tel ? isolateLtrPhone(tel) : maskPracticeExportToken(tel)}`);
    const fax = (p.fax ?? "").trim();
    if (fax) lines.push(`Fax ${show.fax ? fax : maskPracticeExportToken(fax)}`);
    const em = (p.email ?? "").trim();
    if (em) lines.push(`Email ${show.email ? em : maskPracticeExportToken(em)}`);
    const web = (p.web ?? "").trim();
    if (web) {
        const w = web.replace(/^https?:\/\//i, "");
        lines.push(show.web ? w : maskPracticeExportToken(w));
    }
    const kv = (p.kv_number ?? "").trim();
    if (kv) lines.push(`Health insurance no. ${show.kv ? kv : maskPracticeExportToken(kv)}`);
    const ust = (p.vat_id ?? "").trim();
    if (ust) lines.push(`VAT ID ${show.vat ? ust : maskPracticeExportToken(ust)}`);
    const st = (p.tax_number ?? "").trim();
    if (st) lines.push(`Tax no. ${show.tax ? st : maskPracticeExportToken(st)}`);
    const hours = (p.opening_hours ?? "").trim();
    if (hours) lines.push(`Hrs: ${show.hours ? hours : maskPracticeExportToken(hours)}`);
    return lines;
}

/** ZANR / BSNR: exactly 9 digits (no spaces). */
export function isValidPracticeDigitId(value: string): boolean {
    return value.replace(/\D/g, "").length === 9;
}

/** IBAN: DE + 20 digits or general ISO format. */
export function isValidPracticeIban(value: string): boolean {
    const s = value.replace(/\s/g, "").toUpperCase();
    if (!s) return false;
    if (s.startsWith("DE")) return /^DE\d{20}$/.test(s);
    return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s);
}

/** Required fields for invoices/prescriptions per practice master data. */
export function practiceInvoiceRequiredMissing(p: InvoicePractice): boolean {
    return (
        !(p.clinician_name ?? "").trim() ||
        !(p.zanr ?? "").trim() ||
        !(p.bsnr ?? "").trim() ||
        !(p.bank_iban ?? "").trim()
    );
}

/** Invoice PDF and save: current privacy setting from device. */
export function buildInvoiceHeaderAddressLinesForExport(p: InvoicePractice): string[] {
    return buildInvoiceHeaderAddressLines(p, loadPracticeHeaderPrivacy());
}

export function moneyToInvoiceCents(bruto: number): number {
    // No rounding up to 1 ct: an invoice line must equal the computed fee.
    return Math.round(roundMoney2(bruto) * 100);
}

/*
 * Client-side invoice/report numbers (random RE-/BR- suffixes) were removed:
 * GoBD needs gap-free, unique numbers, which only the server can guarantee
 * (`issue_invoice`, `issue_report_pdf`, MASTER device only).
 */

function readInvoicePracticeLocalStorage(): string | null {
    return localStorage.getItem(LS_INVOICE_PRACTICE);
}

export function getInvoicePracticeFromStorage(): InvoicePractice {
    try {
        const raw = readInvoicePracticeLocalStorage();
        if (!raw) return emptyInvoicePractice();
        const j = JSON.parse(raw) as InvoicePracticeJson;
        return parseInvoicePracticeJson(j);
    } catch {
        return emptyInvoicePractice();
    }
}

/** Bumped on every local practice write so async hydrates cannot clobber newer UI state. */
let invoicePracticeWriteEpoch = 0;

/** Test / diagnostics: current optimistic-write generation. */
export function invoicePracticeWriteEpochNow(): number {
    return invoicePracticeWriteEpoch;
}

/** Persists practice master data (invoices, PDFs, Settings). */
export function saveInvoicePracticeToStorage(p: InvoicePractice): Promise<void> {
    invoicePracticeWriteEpoch += 1;
    localStorage.setItem(LS_INVOICE_PRACTICE, JSON.stringify(invoicePracticeToBlob(p)));
    publishPracticeCurrency();
    return syncInvoicePracticeToAppKv(p);
}

function practiceDbBusy(error: unknown): boolean {
    const lower = errorMessage(error).toLowerCase();
    return (
        lower.includes("database is locked") ||
        lower.includes("database is busy") ||
        lower.includes("(code: 5)") ||
        lower.includes("(code: 6)")
    );
}

/** Practice invoice header also in SQLite `app_kv` (practice-wide, LAN-syncable). */
export async function syncInvoicePracticeToAppKv(p: InvoicePractice): Promise<void> {
    const body = JSON.stringify(invoicePracticeToBlob(p));
    let last: unknown;
    for (let attempt = 0; attempt < 6; attempt++) {
        try {
            await setAppKv(INVOICE_PRACTICE_KV_KEY, body);
            return;
        } catch (error) {
            last = error;
            if (!practiceDbBusy(error) || attempt === 5) throw error;
            await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        }
    }
    throw last;
}

/**
 * One-shot: when `app_kv` empty, migrate practice master data from legacy `localStorage` to SQLite.
 * `localStorage` stays as a synchronous cache (same pattern as work hours).
 */
export async function migrateInvoicePracticeLocalStorageToAppKv(): Promise<boolean> {
    if (typeof window === "undefined" || globalThis.localStorage == null) return false;
    try {
        const existing = await getAppKv(INVOICE_PRACTICE_KV_KEY);
        if (existing?.trim()) return false;
        const raw = readInvoicePracticeLocalStorage();
        if (!raw?.trim()) return false;
        await setAppKv(INVOICE_PRACTICE_KV_KEY, raw);
        return true;
    } catch {
        return false;
    }
}

/**
 * Writes the localized opening-hours line onto the practice record.
 * Skips when no practice record exists yet, so a fresh install is not invented.
 */
export async function patchInvoicePracticeOpeningHours(openingHours: string): Promise<void> {
    const trimmed = openingHours.trim();
    if (!trimmed) return;
    // Keep the currency and the rest of the profile already on this screen.
    // Reading the stored profile here used to replace a currency the user had
    // just selected with the previous database copy.
    if (!readInvoicePracticeLocalStorage()?.trim()) return;
    const base = getInvoicePracticeFromStorage();
    if ((base.opening_hours ?? "").trim() === trimmed) return;
    const next = { ...base, opening_hours: trimmed };
    await saveInvoicePracticeToStorage(next);
}

/** Mirror practice profile into localStorage and notify UI (no app_kv write). */
export function mirrorInvoicePracticeToLocalCache(p: InvoicePractice): void {
    invoicePracticeWriteEpoch += 1;
    localStorage.setItem(LS_INVOICE_PRACTICE, JSON.stringify(invoicePracticeToBlob(p)));
    publishPracticeCurrency();
}

/** Loads `invoice.practice.v1` from DB and mirrors to localStorage (desktop). */
export async function hydrateInvoicePracticeFromAppKv(): Promise<InvoicePractice | null> {
    try {
        const epochAtStart = invoicePracticeWriteEpoch;
        await migrateInvoicePracticeLocalStorageToAppKv();
        const raw = await getAppKv(INVOICE_PRACTICE_KV_KEY);
        // A Settings/currency write landed while we were reading app_kv — keep local.
        if (invoicePracticeWriteEpoch !== epochAtStart) {
            return getInvoicePracticeFromStorage();
        }
        if (!raw) return null;
        const j = JSON.parse(raw) as InvoicePracticeJson;
        const merged = parseInvoicePracticeJson(j);
        // Do not call saveInvoicePracticeToStorage here: that re-writes app_kv and
        // can race a Settings change that already updated localStorage first.
        if (invoicePracticeWriteEpoch !== epochAtStart) {
            return getInvoicePracticeFromStorage();
        }
        mirrorInvoicePracticeToLocalCache(merged);
        return merged;
    } catch {
        return null;
    }
}

export * from "./invoice-service-lines";
