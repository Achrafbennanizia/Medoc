import type { Treatment, Examination, Payment } from "@/models/types";
import { formatCurrency } from "@/lib/utils";
import {
    DEFAULT_PRACTICE_HEADER_PRIVACY,
    loadPracticeHeaderPrivacy,
    maskPracticeExportToken,
    type PracticeHeaderPrivacyV1,
} from "@/lib/practice-header-privacy";
import {
    roundMoney2,
    sumPaymentsForTreatment,
    sumPaymentsForExamination,
    PAYMENT_EUR_EPS,
} from "@/lib/payment-booking";
import { paymentLocalYmd } from "@/lib/day-close";

import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";

const LS_INVOICE_PRACTICE = "medoc-invoice-practice-v1";
const INVOICE_PRACTICE_KV_KEY = "invoice.practice.v1" as const;

export type InvoicePractice = {
    name: string;
    addr: string;
    /** KV / practice number — for labels & master data */
    kv_nummer?: string;
    /** Free-text opening hours */
    opening_hours?: string;
    phone?: string;
    fax?: string;
    email?: string;
    /** Practice website (shown in PDF without https:// if desired) */
    web?: string;
    tax_number?: string;
    ust_id?: string;
    /** "Dr. Max Mustermann" */
    clinician_name?: string;
    /** Dentist title label (male/female German UI strings) */
    professional_title?: string;
    /** Zahnarztnummer (9 Ziffern) */
    zanr?: string;
    /** Practice site number (9 digits) */
    bsnr?: string;
    /** LANR (falls abweichend) */
    lanr?: string;
    bankverbindung_iban?: string;
    bankverbindung_bic?: string;
    bankverbindung_bank?: string;
    bankverbindung_inhaber?: string;
    /** Regional dental chamber label (German UI string) */
    kammer?: string;
    /** "KZV …" */
    kzv?: string;
    /** Standard 14 Tage */
    payment_terms_tage?: number;
    /** e.g. VAT-exempt under § 4 No. 14 UStG (DE legal text may stay in value) */
    ust_befreiung_hinweis?: string;
    notfall_phone?: string;
};

const DEFAULT_UST_HINWEIS = "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG";

const DEFAULTS: InvoicePractice = {
    name: "Zahnarztpraxis",
    addr: "Sample Street 1\n12345 City",
    payment_terms_tage: 14,
    ust_befreiung_hinweis: DEFAULT_UST_HINWEIS,
};

const INVOICE_PRACTICE_OPTIONAL_STRING_KEYS = [
    "kv_nummer",
    "opening_hours",
    "phone",
    "fax",
    "email",
    "web",
    "tax_number",
    "ust_id",
    "clinician_name",
    "professional_title",
    "zanr",
    "bsnr",
    "lanr",
    "bankverbindung_iban",
    "bankverbindung_bic",
    "bankverbindung_bank",
    "bankverbindung_inhaber",
    "kammer",
    "kzv",
    "ust_befreiung_hinweis",
    "notfall_phone",
] as const;

type InvoicePracticeJson = {
    name?: string;
    addr?: string;
} & Partial<Record<(typeof INVOICE_PRACTICE_OPTIONAL_STRING_KEYS)[number], string>> & {
    payment_terms_tage?: number;
};

function optStr(s: string | undefined): string | undefined {
    const t = (s ?? "").trim();
    return t || undefined;
}

function parseInvoicePracticeJson(j: InvoicePracticeJson): InvoicePractice {
    const name = (j.name ?? "").trim() || DEFAULTS.name;
    const addr = (j.addr ?? "").trim() || DEFAULTS.addr;
    const out: InvoicePractice = { name, addr };
    for (const key of INVOICE_PRACTICE_OPTIONAL_STRING_KEYS) {
        const version = optStr(j[key]);
        if (version) (out as Record<string, string | number | undefined>)[key] = version;
    }
    const zt = j.payment_terms_tage;
    if (typeof zt === "number" && Number.isFinite(zt) && zt > 0) {
        out.payment_terms_tage = Math.round(zt);
    } else if (out.payment_terms_tage == null) {
        out.payment_terms_tage = DEFAULTS.payment_terms_tage;
    }
    if (!out.ust_befreiung_hinweis?.trim()) {
        out.ust_befreiung_hinweis = DEFAULT_UST_HINWEIS;
    }
    return out;
}

function invoicePracticeToBlob(p: InvoicePractice): Record<string, string | number> {
    const blob: Record<string, string | number> = {
        name: p.name.trim() || DEFAULTS.name,
        addr: p.addr.trim() || DEFAULTS.addr,
    };
    for (const key of INVOICE_PRACTICE_OPTIONAL_STRING_KEYS) {
        const t = optStr(p[key]);
        if (t) blob[key] = t;
    }
    const zt = p.payment_terms_tage ?? DEFAULTS.payment_terms_tage;
    if (zt != null && Number.isFinite(zt) && zt > 0) blob.payment_terms_tage = Math.round(zt);
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
    if (tel) lines.push(`Tel. ${show.tel ? tel : maskPracticeExportToken(tel)}`);
    const fax = (p.fax ?? "").trim();
    if (fax) lines.push(`Fax ${show.fax ? fax : maskPracticeExportToken(fax)}`);
    const em = (p.email ?? "").trim();
    if (em) lines.push(`E-Mail ${show.email ? em : maskPracticeExportToken(em)}`);
    const web = (p.web ?? "").trim();
    if (web) {
        const w = web.replace(/^https?:\/\//i, "");
        lines.push(show.web ? w : maskPracticeExportToken(w));
    }
    const kv = (p.kv_nummer ?? "").trim();
    if (kv) lines.push(`KV- / Betriebsnr. ${show.kv ? kv : maskPracticeExportToken(kv)}`);
    const ust = (p.ust_id ?? "").trim();
    if (ust) lines.push(`USt-IdNr. ${show.ust ? ust : maskPracticeExportToken(ust)}`);
    const st = (p.tax_number ?? "").trim();
    if (st) lines.push(`St.-Nr. ${show.steuer ? st : maskPracticeExportToken(st)}`);
    const oz = (p.opening_hours ?? "").trim();
    if (oz) lines.push(`Hrs: ${show.oz ? oz : maskPracticeExportToken(oz)}`);
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
export function practiceInvoicePflichtMissing(p: InvoicePractice): boolean {
    return (
        !(p.clinician_name ?? "").trim() ||
        !(p.zanr ?? "").trim() ||
        !(p.bsnr ?? "").trim() ||
        !(p.bankverbindung_iban ?? "").trim()
    );
}

/** Invoice PDF and save: current privacy setting from device. */
export function buildInvoiceHeaderAddressLinesForExport(p: InvoicePractice): string[] {
    return buildInvoiceHeaderAddressLines(p, loadPracticeHeaderPrivacy());
}

export type InvoiceNumberOpts = {
    /** Numbers already in local history / session — avoid collision. */
    reserved?: ReadonlySet<string>;
};

function randomUint32(): number {
    const b = new Uint8Array(4);
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(b);
    } else {
        b[0] = Math.floor(Math.random() * 256);
        b[1] = Math.floor(Math.random() * 256);
        b[2] = Math.floor(Math.random() * 256);
        b[3] = Math.floor(Math.random() * 256);
    }
    return b[0]! * 0x1_00_00_00 + b[1]! * 0x1_00_00 + b[2]! * 0x1_00 + b[3]!;
}

function moneyToInvoiceCents(bruto: number): number {
    const eur = roundMoney2(bruto);
    let cents = Math.round(eur * 100);
    if (cents === 0 && eur > PAYMENT_EUR_EPS) cents = 1;
    return cents;
}

/** Auto invoice number — RE-YYYYMMDD-RANDOM (short date fallback without date prefix). */
export function nextInvoiceNumber(ymd: string, opts?: InvoiceNumberOpts): string {
    const reserved = opts?.reserved;
    const d = ymd.replace(/-/g, "").replace(/[^\d]/g, "");
    if (d.length < 8) {
        for (let i = 0; i < 48; i++) {
            const num = `RE-${Date.now().toString(36).toUpperCase()}-${randomUint32().toString(36).toUpperCase()}`;
            if (!reserved?.has(num)) return num;
        }
        return `RE-${Date.now()}-${randomUint32()}`;
    }
    const prefix = d.slice(0, 8);
    for (let i = 0; i < 80; i++) {
        const s = randomUint32().toString(36).toUpperCase().padStart(6, "0");
        const num = `RE-${prefix}-${s}`;
        if (!reserved?.has(num)) return num;
    }
    return `RE-${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUint32().toString(36).toUpperCase()}`;
}

export function getInvoicePracticeFromStorage(): InvoicePractice {
    try {
        const raw = localStorage.getItem(LS_INVOICE_PRACTICE);
        if (!raw) return { ...DEFAULTS };
        const j = JSON.parse(raw) as InvoicePracticeJson;
        return parseInvoicePracticeJson(j);
    } catch {
        return { ...DEFAULTS };
    }
}

/** Persists practice master data (invoices, PDFs, Settings). */
export function saveInvoicePracticeToStorage(p: InvoicePractice): void {
    localStorage.setItem(LS_INVOICE_PRACTICE, JSON.stringify(invoicePracticeToBlob(p)));
}

/** Practice invoice header also in SQLite `app_kv` (practice-wide, LAN-syncable). */
export async function syncInvoicePracticeToAppKv(p: InvoicePractice): Promise<void> {
    await setAppKv(INVOICE_PRACTICE_KV_KEY, JSON.stringify(invoicePracticeToBlob(p)));
}

/**
 * One-shot: when `app_kv` empty, migrate practice master data from legacy `localStorage` to SQLite.
 * `localStorage` bleibt als synchroner Cache (wie Arbeitszeiten).
 */
export async function migrateInvoicePracticeLocalStorageToAppKv(): Promise<boolean> {
    if (typeof window === "undefined" || globalThis.localStorage == null) return false;
    try {
        const existing = await getAppKv(INVOICE_PRACTICE_KV_KEY);
        if (existing?.trim()) return false;
        const raw = localStorage.getItem(LS_INVOICE_PRACTICE);
        if (!raw?.trim()) return false;
        await setAppKv(INVOICE_PRACTICE_KV_KEY, raw);
        return true;
    } catch {
        return false;
    }
}

/** Loads `invoice.practice.v1` from DB and mirrors to localStorage (desktop). */
export async function hydrateInvoicePracticeFromAppKv(): Promise<InvoicePractice | null> {
    try {
        const raw = await getAppKv(INVOICE_PRACTICE_KV_KEY);
        if (!raw) return null;
        const j = JSON.parse(raw) as InvoicePracticeJson;
        const merged = parseInvoicePracticeJson(j);
        saveInvoicePracticeToStorage(merged);
        return merged;
    } catch {
        return null;
    }
}

/** Daily report / PDF no. — longer random part than before (collisions rarer). */
export function nextReportNumber(ymd: string, opts?: InvoiceNumberOpts): string {
    const reserved = opts?.reserved;
    const d = ymd.replace(/-/g, "").replace(/[^\d]/g, "");
    const dayPart = d.slice(0, 8) || "--------";
    for (let i = 0; i < 80; i++) {
        const hi = randomUint32().toString(36).toUpperCase().padStart(6, "0");
        const lo = randomUint32().toString(36).toUpperCase().padStart(6, "0");
        const num = `BR-${dayPart}-${hi}${lo}`;
        if (!reserved?.has(num)) return num;
    }
    return `BR-${dayPart}-${Date.now().toString(36).toUpperCase()}-${randomUint32().toString(36).toUpperCase()}`;
}

function parseServiceItemLink(
    version: string,
):
    | { kind: "treatment"; id: string }
    | { kind: "examination"; id: string }
    | null {
    if (version.startsWith("treatment:")) return { kind: "treatment", id: version.slice("treatment:".length) };
    if (version.startsWith("examination:")) return { kind: "examination", id: version.slice("examination:".length) };
    if (version.startsWith("unter:")) return { kind: "examination", id: version.slice("unter:".length) };
    return null;
}

export function lineFromServiceItemChoice(
    link: string,
    patientId: string,
    treatments: Treatment[],
    examinations: Examination[],
    payments: Payment[],
): { description: string; amount_cents: number; note_line?: string } | null {
    const p = parseServiceItemLink(link);
    if (!p) return null;
    if (p.kind === "treatment") {
        const b = treatments.find((x) => x.id === p.id);
        if (!b) return null;
        const paidTotal = roundMoney2(sumPaymentsForTreatment(payments, patientId, p.id));
        const cost = b.total_cost != null && Number.isFinite(b.total_cost) ? roundMoney2(b.total_cost) : null;
        const serviceLabel = (b.service_name || b.description || b.kind || "Treatment").trim();
        const bn = (b.treatment_number ?? "").trim() || "—";
        const desc = `B-Nr. ${bn} — ${serviceLabel}`;
        const costLabel = cost != null ? formatCurrency(cost) : "—";
        const detail = `Cost (due): ${costLabel} · Paid (in system): ${formatCurrency(paidTotal)}`;
        const bruto = cost != null && cost > 0 ? cost : paidTotal > 0 ? paidTotal : 0.01;
        const amount_cents = Math.max(1, moneyToInvoiceCents(bruto));
        return { description: `${desc}\n${detail}`, amount_cents };
    }
    const u = examinations.find((x) => x.id === p.id);
    if (!u) return null;
    const paidTotal = roundMoney2(sumPaymentsForExamination(payments, patientId, p.id));
    const un = (u.examination_number ?? "").trim() || "—";
    const serviceLabel = (u.diagnosis || u.results || u.chief_complaint || "Examination").trim().slice(0, 200);
    const desc = `U-Nr. ${un} — ${serviceLabel}`;
    const bruto = paidTotal > 0 ? paidTotal : 0.01;
    const amount_cents = Math.max(1, moneyToInvoiceCents(bruto));
    const detail = `Paid (in system): ${formatCurrency(paidTotal)}`;
    return { description: `${desc}\n${detail}`, amount_cents };
}

/**
 * One Patient / one date: grouped payment lines for daily report PDF.
 * (The full PDF in `day_close-invoice-pdf.ts` calls this per Patient and merges blocks.)
 */
export function buildDailyReportLines(
    as_of_date: string,
    patientId: string,
    payments: Payment[],
    treatments: Treatment[],
    examinations: Examination[],
): { description: string; amount_cents: number }[] {
    const onDay = payments.filter(
        (z) => z.patient_id === patientId && paymentLocalYmd(z.created_at) === as_of_date && z.status !== "CANCELLED",
    );
    const paidOnDay = (id: "treatment" | "examination", uId: string) =>
        roundMoney2(
            onDay
                .filter((z) => (id === "treatment" ? z.treatment_id === uId : z.examination_id === uId))
                .reduce((s, z) => s + z.amount, 0),
        );
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const z of onDay) {
        if (z.treatment_id) {
            const k = `b:${z.treatment_id}`;
            if (!seen.has(k)) {
                seen.add(k);
                keys.push(`treatment:${z.treatment_id}`);
            }
        } else if (z.examination_id) {
            const k = `u:${z.examination_id}`;
            if (!seen.has(k)) {
                seen.add(k);
                keys.push(`examination:${z.examination_id}`);
            }
        }
    }
    const out: { description: string; amount_cents: number }[] = [];
    for (const k of keys) {
        const row = lineFromServiceItemChoice(k, patientId, treatments, examinations, payments);
        if (row) {
            const p = parseServiceItemLink(k);
            const tagDosing = p
                ? p.kind === "treatment"
                    ? paidOnDay("treatment", p.id)
                    : paidOnDay("examination", p.id)
                : 0;
            const withDay = `${row.description}\nPosted on report date ${as_of_date}: ${formatCurrency(tagDosing)}`;
            out.push({ description: withDay, amount_cents: row.amount_cents });
        }
    }
    if (out.length === 0) {
        out.push({
            description: `Daily report ${as_of_date} — no linked treatment/examination payments for this patient on the report date.`,
            amount_cents: 1,
        });
    }
    return out;
}
