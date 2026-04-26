import type { Behandlung, Untersuchung, Zahlung } from "@/models/types";
import { formatCurrency } from "@/lib/utils";
import { roundMoney2, sumZahlungenForBehandlung, sumZahlungenForUntersuchung } from "@/lib/zahlung-buchung";
import { zahlungLocalYmd } from "@/lib/tagesabschluss";

const LS_INVOICE_PRAXIS = "medoc-invoice-praxis-v1";

export type InvoicePraxis = { name: string; addr: string };

const DEFAULTS: InvoicePraxis = { name: "Zahnarztpraxis", addr: "Musterstraße 1\n12345 Ort" };

/** Auto-Rechnungsnummer — Lesemodus wie andere erzeugte IDs: RE-YYYYMMDD-RANDOM */
export function nextRechnungsnummer(ymd: string): string {
    const d = ymd.replace(/-/g, "").replace(/[^\d]/g, "");
    if (d.length < 8) {
        return `RE-${Date.now().toString(36).toUpperCase()}`;
    }
    const b = new Uint8Array(4);
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(b);
    } else {
        b[0] = Math.random() * 256;
        b[1] = Math.random() * 256;
        b[2] = Math.random() * 256;
        b[3] = Math.random() * 256;
    }
    const n = b[0]! * 0x1_00_00_00 + b[1]! * 0x1_00_00 + b[2]! * 0x1_00 + b[3]!;
    const s = n.toString(36).toUpperCase().padStart(6, "0");
    return `RE-${d.slice(0, 8)}-${s}`;
}

export function getInvoicePraxisFromStorage(): InvoicePraxis {
    try {
        const raw = localStorage.getItem(LS_INVOICE_PRAXIS);
        if (!raw) return { ...DEFAULTS };
        const j = JSON.parse(raw) as { name?: string; addr?: string };
        const name = (j.name ?? "").trim() || DEFAULTS.name;
        const addr = (j.addr ?? "").trim() || DEFAULTS.addr;
        return { name, addr };
    } catch {
        return { ...DEFAULTS };
    }
}

/** Tagesbericht / PDF-Nr. */
export function nextBerichtNummer(ymd: string): string {
    const d = ymd.replace(/-/g, "").replace(/[^\d]/g, "");
    const b = new Uint8Array(3);
    globalThis.crypto?.getRandomValues?.(b) ?? b.fill(0);
    const n = b[0]! * 0x1_00_00 + b[1]! * 0x1_00 + b[2]!;
    return `BR-${d.slice(0, 8) || "--------"}-${n.toString(36).toUpperCase().padStart(5, "0")}`;
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
        const amount_cents = Math.max(1, Math.round(bruto * 100));
        return { description: `${desc}\n${detail}`, amount_cents };
    }
    const u = untersuchungen.find((x) => x.id === p.id);
    if (!u) return null;
    const paidGes = roundMoney2(sumZahlungenForUntersuchung(zahlungen, patientId, p.id));
    const un = (u.untersuchungsnummer ?? "").trim() || "—";
    const leist = (u.diagnose || u.ergebnisse || u.beschwerden || "Untersuchung").trim().slice(0, 200);
    const desc = `U-Nr. ${un} — ${leist}`;
    const bruto = paidGes > 0 ? paidGes : 0.01;
    const amount_cents = Math.max(1, Math.round(bruto * 100));
    const detail = `Gezahlt (i. S.): ${formatCurrency(paidGes)}`;
    return { description: `${desc}\n${detail}`, amount_cents };
}

/**
 * Tagesbericht: alle Zahlungen am Stichtag für den Patienten, nach B/U gruppiert – eine Zeile pro Leistung.
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
