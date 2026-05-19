import type { Behandlung, Untersuchung, Zahlung } from "@/models/types";
import { formatCurrency } from "@/lib/utils";
import {
    DEFAULT_PRAXIS_HEADER_PRIVACY,
    loadPraxisHeaderPrivacy,
    maskPraxisExportToken,
    type PraxisHeaderPrivacyV1,
} from "@/lib/praxis-header-privacy";
import {
    roundMoney2,
    sumZahlungenForBehandlung,
    sumZahlungenForUntersuchung,
    ZAHL_EUR_EPS,
} from "@/lib/zahlung-buchung";
import { zahlungLocalYmd } from "@/lib/tagesabschluss";

import { getAppKv, setAppKv } from "@/controllers/app-kv.controller";

const LS_INVOICE_PRAXIS = "medoc-invoice-praxis-v1";
const INVOICE_PRAXIS_KV_KEY = "invoice.praxis.v1" as const;

export type InvoicePraxis = {
    name: string;
    addr: string;
    /** KV-/Betriebsnummer — für Etiketten & Stammdaten */
    kv_nummer?: string;
    /** Freitext Öffnungszeiten */
    oeffnungszeiten?: string;
    telefon?: string;
    fax?: string;
    email?: string;
    /** Praxis-Webseite (wird im PDF ohne https:// dargestellt, wenn gewünscht) */
    web?: string;
    steuernummer?: string;
    ust_id?: string;
    /** "Dr. Max Mustermann" */
    behandler_name?: string;
    /** "Zahnarzt" / "Zahnärztin" */
    berufsbezeichnung?: string;
    /** Zahnarztnummer (9 Ziffern) */
    zanr?: string;
    /** Betriebsstättennummer (9 Ziffern) */
    bsnr?: string;
    /** LANR (falls abweichend) */
    lanr?: string;
    bankverbindung_iban?: string;
    bankverbindung_bic?: string;
    bankverbindung_bank?: string;
    bankverbindung_inhaber?: string;
    /** "Landeszahnärztekammer …" */
    kammer?: string;
    /** "KZV …" */
    kzv?: string;
    /** Standard 14 Tage */
    zahlungsziel_tage?: number;
    /** z. B. Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG */
    ust_befreiung_hinweis?: string;
    notfall_telefon?: string;
};

const DEFAULT_UST_HINWEIS = "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG";

const DEFAULTS: InvoicePraxis = {
    name: "Zahnarztpraxis",
    addr: "Musterstraße 1\n12345 Ort",
    zahlungsziel_tage: 14,
    ust_befreiung_hinweis: DEFAULT_UST_HINWEIS,
};

const INVOICE_PRAXIS_OPTIONAL_STRING_KEYS = [
    "kv_nummer",
    "oeffnungszeiten",
    "telefon",
    "fax",
    "email",
    "web",
    "steuernummer",
    "ust_id",
    "behandler_name",
    "berufsbezeichnung",
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
    "notfall_telefon",
] as const;

type InvoicePraxisJson = {
    name?: string;
    addr?: string;
} & Partial<Record<(typeof INVOICE_PRAXIS_OPTIONAL_STRING_KEYS)[number], string>> & {
    zahlungsziel_tage?: number;
};

function optStr(s: string | undefined): string | undefined {
    const t = (s ?? "").trim();
    return t || undefined;
}

function parseInvoicePraxisJson(j: InvoicePraxisJson): InvoicePraxis {
    const name = (j.name ?? "").trim() || DEFAULTS.name;
    const addr = (j.addr ?? "").trim() || DEFAULTS.addr;
    const out: InvoicePraxis = { name, addr };
    for (const key of INVOICE_PRAXIS_OPTIONAL_STRING_KEYS) {
        const v = optStr(j[key]);
        if (v) (out as Record<string, string | number | undefined>)[key] = v;
    }
    const zt = j.zahlungsziel_tage;
    if (typeof zt === "number" && Number.isFinite(zt) && zt > 0) {
        out.zahlungsziel_tage = Math.round(zt);
    } else if (out.zahlungsziel_tage == null) {
        out.zahlungsziel_tage = DEFAULTS.zahlungsziel_tage;
    }
    if (!out.ust_befreiung_hinweis?.trim()) {
        out.ust_befreiung_hinweis = DEFAULT_UST_HINWEIS;
    }
    return out;
}

function invoicePraxisToBlob(p: InvoicePraxis): Record<string, string | number> {
    const blob: Record<string, string | number> = {
        name: p.name.trim() || DEFAULTS.name,
        addr: p.addr.trim() || DEFAULTS.addr,
    };
    for (const key of INVOICE_PRAXIS_OPTIONAL_STRING_KEYS) {
        const t = optStr(p[key]);
        if (t) blob[key] = t;
    }
    const zt = p.zahlungsziel_tage ?? DEFAULTS.zahlungsziel_tage;
    if (zt != null && Number.isFinite(zt) && zt > 0) blob.zahlungsziel_tage = Math.round(zt);
    return blob;
}

/**
 * Zeilen für den Praxis-Kopf im PDF (`practice_address`): Anschrift, dann Kontakt und Pflichtangaben.
 * Reihenfolge orientiert sich an typischen Rechnungs-/Briefköpfen.
 *
 * @param show — pro Feld `true` = Klartext, `false` = maskiert (wie in Einstellungen › Praxis).
 */
export function buildInvoiceHeaderAddressLines(p: InvoicePraxis, show: PraxisHeaderPrivacyV1 = DEFAULT_PRAXIS_HEADER_PRIVACY): string[] {
    const lines: string[] = [];
    for (const raw of (p.addr ?? "").split(/\r?\n/)) {
        const t = raw.trim();
        if (t) lines.push(t);
    }
    const tel = (p.telefon ?? "").trim();
    if (tel) lines.push(`Tel. ${show.tel ? tel : maskPraxisExportToken(tel)}`);
    const fax = (p.fax ?? "").trim();
    if (fax) lines.push(`Fax ${show.fax ? fax : maskPraxisExportToken(fax)}`);
    const em = (p.email ?? "").trim();
    if (em) lines.push(`E-Mail ${show.email ? em : maskPraxisExportToken(em)}`);
    const web = (p.web ?? "").trim();
    if (web) {
        const w = web.replace(/^https?:\/\//i, "");
        lines.push(show.web ? w : maskPraxisExportToken(w));
    }
    const kv = (p.kv_nummer ?? "").trim();
    if (kv) lines.push(`KV- / Betriebsnr. ${show.kv ? kv : maskPraxisExportToken(kv)}`);
    const ust = (p.ust_id ?? "").trim();
    if (ust) lines.push(`USt-IdNr. ${show.ust ? ust : maskPraxisExportToken(ust)}`);
    const st = (p.steuernummer ?? "").trim();
    if (st) lines.push(`St.-Nr. ${show.steuer ? st : maskPraxisExportToken(st)}`);
    const oz = (p.oeffnungszeiten ?? "").trim();
    if (oz) lines.push(`Öffn.: ${show.oz ? oz : maskPraxisExportToken(oz)}`);
    return lines;
}

/** ZANR / BSNR: genau 9 Ziffern (ohne Leerzeichen). */
export function isValidPraxisDigitId(value: string): boolean {
    return value.replace(/\D/g, "").length === 9;
}

/** IBAN: DE + 20 Ziffern oder allgemeines ISO-Format. */
export function isValidPraxisIban(value: string): boolean {
    const s = value.replace(/\s/g, "").toUpperCase();
    if (!s) return false;
    if (s.startsWith("DE")) return /^DE\d{20}$/.test(s);
    return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s);
}

/** Pflichtfelder für Rechnungen/Rezepte laut Praxis-Stammdaten. */
export function praxisRechnungPflichtMissing(p: InvoicePraxis): boolean {
    return (
        !(p.behandler_name ?? "").trim() ||
        !(p.zanr ?? "").trim() ||
        !(p.bsnr ?? "").trim() ||
        !(p.bankverbindung_iban ?? "").trim()
    );
}

/** Rechnungs-PDF und Speichern: aktuelle Privatsphäre-Einstellung aus dem Gerät. */
export function buildInvoiceHeaderAddressLinesForExport(p: InvoicePraxis): string[] {
    return buildInvoiceHeaderAddressLines(p, loadPraxisHeaderPrivacy());
}

export type InvoiceNumberOpts = {
    /** Nummern, die bereits im lokalen Verlauf / Session liegen — Kollision vermeiden. */
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
    if (cents === 0 && eur > ZAHL_EUR_EPS) cents = 1;
    return cents;
}

/** Auto-Rechnungsnummer — RE-YYYYMMDD-RANDOM (bei Kurzdatum Fallback ohne Datums-Präfix). */
export function nextRechnungsnummer(ymd: string, opts?: InvoiceNumberOpts): string {
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

export function getInvoicePraxisFromStorage(): InvoicePraxis {
    try {
        const raw = localStorage.getItem(LS_INVOICE_PRAXIS);
        if (!raw) return { ...DEFAULTS };
        const j = JSON.parse(raw) as InvoicePraxisJson;
        return parseInvoicePraxisJson(j);
    } catch {
        return { ...DEFAULTS };
    }
}

/** Persistiert Praxis-Stammdaten (Rechnungen, PDFs, Einstellungen). */
export function saveInvoicePraxisToStorage(p: InvoicePraxis): void {
    localStorage.setItem(LS_INVOICE_PRAXIS, JSON.stringify(invoicePraxisToBlob(p)));
}

/** Praxis-Rechnungskopf zusätzlich in SQLite `app_kv` (praxisweit, LAN-synchronisierbar). */
export async function syncInvoicePraxisToAppKv(p: InvoicePraxis): Promise<void> {
    await setAppKv(INVOICE_PRAXIS_KV_KEY, JSON.stringify(invoicePraxisToBlob(p)));
}

/** Lädt `invoice.praxis.v1` aus der DB und spiegelt nach localStorage (Desktop). */
export async function hydrateInvoicePraxisFromAppKv(): Promise<InvoicePraxis | null> {
    try {
        const raw = await getAppKv(INVOICE_PRAXIS_KV_KEY);
        if (!raw) return null;
        const j = JSON.parse(raw) as InvoicePraxisJson;
        const merged = parseInvoicePraxisJson(j);
        saveInvoicePraxisToStorage(merged);
        return merged;
    } catch {
        return null;
    }
}

/** Tagesbericht / PDF-Nr. — längerer Zufallsteil als früher (Kollisionen seltener). */
export function nextBerichtNummer(ymd: string, opts?: InvoiceNumberOpts): string {
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

function parseLeistungLink(
    v: string,
):
    | { kind: "behand"; id: string }
    | { kind: "unter"; id: string }
    | null {
    if (v.startsWith("behand:")) return { kind: "behand", id: v.slice("behand:".length) };
    if (v.startsWith("unter:")) return { kind: "unter", id: v.slice("unter:".length) };
    return null;
}

export function lineFromLeistungWahl(
    link: string,
    patientId: string,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
    zahlungen: Zahlung[],
): { description: string; amount_cents: number; note_line?: string } | null {
    const p = parseLeistungLink(link);
    if (!p) return null;
    if (p.kind === "behand") {
        const b = behandlungen.find((x) => x.id === p.id);
        if (!b) return null;
        const paidGes = roundMoney2(sumZahlungenForBehandlung(zahlungen, patientId, p.id));
        const cost = b.gesamtkosten != null && Number.isFinite(b.gesamtkosten) ? roundMoney2(b.gesamtkosten) : null;
        const leist = (b.leistungsname || b.beschreibung || b.art || "Behandlung").trim();
        const bn = (b.behandlungsnummer ?? "").trim() || "—";
        const desc = `B-Nr. ${bn} — ${leist}`;
        const kosten = cost != null ? formatCurrency(cost) : "—";
        const detail = `Kosten (Soll): ${kosten} · Gezahlt (i. S.): ${formatCurrency(paidGes)}`;
        const bruto = cost != null && cost > 0 ? cost : paidGes > 0 ? paidGes : 0.01;
        const amount_cents = Math.max(1, moneyToInvoiceCents(bruto));
        return { description: `${desc}\n${detail}`, amount_cents };
    }
    const u = untersuchungen.find((x) => x.id === p.id);
    if (!u) return null;
    const paidGes = roundMoney2(sumZahlungenForUntersuchung(zahlungen, patientId, p.id));
    const un = (u.untersuchungsnummer ?? "").trim() || "—";
    const leist = (u.diagnose || u.ergebnisse || u.beschwerden || "Untersuchung").trim().slice(0, 200);
    const desc = `U-Nr. ${un} — ${leist}`;
    const bruto = paidGes > 0 ? paidGes : 0.01;
    const amount_cents = Math.max(1, moneyToInvoiceCents(bruto));
    const detail = `Gezahlt (i. S.): ${formatCurrency(paidGes)}`;
    return { description: `${desc}\n${detail}`, amount_cents };
}

/**
 * Ein Patient / ein Stichtag: gruppierte Zahlungs-Zeilen für den Tagesbericht-PDF.
 * (Der Gesamt-PDF in `tagesabschluss-invoice-pdf.ts` ruft diese Funktion je Patient auf und fügt die Blöcke zusammen.)
 */
export function buildTagesberichtLines(
    stichtag: string,
    patientId: string,
    zahlungen: Zahlung[],
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
): { description: string; amount_cents: number }[] {
    const onDay = zahlungen.filter(
        (z) => z.patient_id === patientId && zahlungLocalYmd(z.created_at) === stichtag && z.status !== "STORNIERT",
    );
    const paidAmTag = (id: "behand" | "unter", uId: string) =>
        roundMoney2(
            onDay
                .filter((z) => (id === "behand" ? z.behandlung_id === uId : z.untersuchung_id === uId))
                .reduce((s, z) => s + z.betrag, 0),
        );
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const z of onDay) {
        if (z.behandlung_id) {
            const k = `b:${z.behandlung_id}`;
            if (!seen.has(k)) {
                seen.add(k);
                keys.push(`behand:${z.behandlung_id}`);
            }
        } else if (z.untersuchung_id) {
            const k = `u:${z.untersuchung_id}`;
            if (!seen.has(k)) {
                seen.add(k);
                keys.push(`unter:${z.untersuchung_id}`);
            }
        }
    }
    const out: { description: string; amount_cents: number }[] = [];
    for (const k of keys) {
        const row = lineFromLeistungWahl(k, patientId, behandlungen, untersuchungen, zahlungen);
        if (row) {
            const p = parseLeistungLink(k);
            const tagEinnahme = p
                ? p.kind === "behand"
                    ? paidAmTag("behand", p.id)
                    : paidAmTag("unter", p.id)
                : 0;
            const withDay = `${row.description}\nAm Stichtag ${stichtag} verbucht: ${formatCurrency(tagEinnahme)}`;
            out.push({ description: withDay, amount_cents: row.amount_cents });
        }
    }
    if (out.length === 0) {
        out.push({
            description: `Tagesbericht ${stichtag} — am Stichtag keine zugeordneten B-/U-Zahlungen für diesen Patienten.`,
            amount_cents: 1,
        });
    }
    return out;
}
