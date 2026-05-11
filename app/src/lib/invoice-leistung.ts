import type { Behandlung, Untersuchung, Zahlung } from "@/models/types";
import { formatCurrency } from "@/lib/utils";
import {
    roundMoney2,
    sumZahlungenForBehandlung,
    sumZahlungenForUntersuchung,
    ZAHL_EUR_EPS,
} from "@/lib/zahlung-buchung";
import { zahlungLocalYmd } from "@/lib/tagesabschluss";

const LS_INVOICE_PRAXIS = "medoc-invoice-praxis-v1";

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
};

const DEFAULTS: InvoicePraxis = { name: "Zahnarztpraxis", addr: "Musterstraße 1\n12345 Ort" };

/**
 * Zeilen für den Praxis-Kopf im PDF (`practice_address`): Anschrift, dann Kontakt und Pflichtangaben.
 * Reihenfolge orientiert sich an typischen Rechnungs-/Briefköpfen.
 */
export function buildInvoiceHeaderAddressLines(p: InvoicePraxis): string[] {
    const lines: string[] = [];
    for (const raw of (p.addr ?? "").split(/\r?\n/)) {
        const t = raw.trim();
        if (t) lines.push(t);
    }
    const tel = (p.telefon ?? "").trim();
    if (tel) lines.push(`Tel. ${tel}`);
    const fax = (p.fax ?? "").trim();
    if (fax) lines.push(`Fax ${fax}`);
    const em = (p.email ?? "").trim();
    if (em) lines.push(`E-Mail ${em}`);
    const web = (p.web ?? "").trim();
    if (web) lines.push(web.replace(/^https?:\/\//i, ""));
    const kv = (p.kv_nummer ?? "").trim();
    if (kv) lines.push(`KV- / Betriebsnr. ${kv}`);
    const ust = (p.ust_id ?? "").trim();
    if (ust) lines.push(`USt-IdNr. ${ust}`);
    const st = (p.steuernummer ?? "").trim();
    if (st) lines.push(`St.-Nr. ${st}`);
    const oz = (p.oeffnungszeiten ?? "").trim();
    if (oz) lines.push(`Öffn.: ${oz}`);
    return lines;
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
        const j = JSON.parse(raw) as {
            name?: string;
            addr?: string;
            kv_nummer?: string;
            oeffnungszeiten?: string;
            telefon?: string;
            fax?: string;
            email?: string;
            web?: string;
            steuernummer?: string;
            ust_id?: string;
        };
        const name = (j.name ?? "").trim() || DEFAULTS.name;
        const addr = (j.addr ?? "").trim() || DEFAULTS.addr;
        const opt = (s: string | undefined) => {
            const t = (s ?? "").trim();
            return t || undefined;
        };
        return {
            name,
            addr,
            kv_nummer: opt(j.kv_nummer),
            oeffnungszeiten: opt(j.oeffnungszeiten),
            telefon: opt(j.telefon),
            fax: opt(j.fax),
            email: opt(j.email),
            web: opt(j.web),
            steuernummer: opt(j.steuernummer),
            ust_id: opt(j.ust_id),
        };
    } catch {
        return { ...DEFAULTS };
    }
}

/** Persistiert Praxis-Stammdaten (Rechnungen, PDFs, Einstellungen). */
export function saveInvoicePraxisToStorage(p: InvoicePraxis): void {
    const blob: Record<string, string> = {
        name: p.name.trim() || DEFAULTS.name,
        addr: p.addr.trim() || DEFAULTS.addr,
    };
    const put = (key: string, v: string | undefined) => {
        const t = (v ?? "").trim();
        if (t) blob[key] = t;
    };
    put("kv_nummer", p.kv_nummer);
    put("oeffnungszeiten", p.oeffnungszeiten);
    put("telefon", p.telefon);
    put("fax", p.fax);
    put("email", p.email);
    put("web", p.web);
    put("steuernummer", p.steuernummer);
    put("ust_id", p.ust_id);
    localStorage.setItem(LS_INVOICE_PRAXIS, JSON.stringify(blob));
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
