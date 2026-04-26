/**
 * Shared logic for payment booking: Kundenleistungen (Patientenakte) and Finanzen → Neue Zahlung.
 */
import type { Behandlung, Untersuchung, Zahlung } from "@/models/types";

export const ZAHLUNG_ART_SELECT = [
    { value: "BAR", label: "Bar" },
    { value: "KARTE", label: "Karte" },
    { value: "UEBERWEISUNG", label: "Überweisung" },
    { value: "RECHNUNG", label: "Rechnung" },
] as const;

/** Status-Badge-Anzeige für Zahlungszeilen (Patientenakte + Finanzen). */
export function zahlStatusDisplay(status: string): { variant: "success" | "warning" | "default"; label: string } {
    const s = status.trim();
    if (s === "BEZAHLT") return { variant: "success", label: "Bezahlt" };
    if (s === "TEILBEZAHLT") return { variant: "warning", label: "Teilbezahlt" };
    if (s === "AUSSTEHEND") return { variant: "warning", label: "Ausstehend" };
    if (s === "STORNIERT") return { variant: "default", label: "Storniert" };
    return { variant: "default", label: s || "—" };
}

export function zahlungsartLabel(art: string): string {
    const row = ZAHLUNG_ART_SELECT.find((o) => o.value === art);
    return row?.label ?? art;
}

export function zahlCountsTowardPaid(status: string): boolean {
    return status.trim() !== "STORNIERT";
}

export const ZAHL_EUR_EPS = 0.005;

export function roundMoney2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function sumZahlungenForBehandlung(zahlungen: Zahlung[], patientId: string, behandlungId: string): number {
    return zahlungen
        .filter(
            (z) =>
                z.patient_id === patientId
                && z.behandlung_id === behandlungId
                && zahlCountsTowardPaid(z.status),
        )
        .reduce((s, z) => s + z.betrag, 0);
}

export function sumZahlungenForUntersuchung(zahlungen: Zahlung[], patientId: string, untersuchungId: string): number {
    return zahlungen
        .filter(
            (z) =>
                z.patient_id === patientId
                && z.untersuchung_id === untersuchungId
                && zahlCountsTowardPaid(z.status),
        )
        .reduce((s, z) => s + z.betrag, 0);
}

/** Max. zulässiger Betrag für eine neue Zahlung auf diese Behandlung (Soll minus bereits gezahlt). */
export function maxNeuZahlungBehandlung(
    zahlungen: Zahlung[],
    patientId: string,
    behandlungId: string,
    gesamtkosten: number | null,
): number | null {
    if (gesamtkosten == null || !Number.isFinite(gesamtkosten)) return null;
    if (gesamtkosten <= 0) return 0;
    const paid = sumZahlungenForBehandlung(zahlungen, patientId, behandlungId);
    return Math.max(0, roundMoney2(gesamtkosten - paid));
}

/** Max. Betrag bei Bearbeitung: Soll minus alle anderen Zahlungen derselben Zeile. */
export function maxEditZahlungBehandlung(
    zahlungen: Zahlung[],
    patientId: string,
    behandlungId: string,
    excludeZahlungId: string,
    gesamtkosten: number | null,
): number | null {
    if (gesamtkosten == null || !Number.isFinite(gesamtkosten)) return null;
    if (gesamtkosten <= 0) return 0;
    const otherPaid = zahlungen
        .filter(
            (x) =>
                x.patient_id === patientId
                && x.behandlung_id === behandlungId
                && x.id !== excludeZahlungId
                && zahlCountsTowardPaid(x.status),
        )
        .reduce((s, x) => s + x.betrag, 0);
    return Math.max(0, roundMoney2(gesamtkosten - otherPaid));
}

export function zahlHistoryForBehandlung(zahlungen: Zahlung[], patientId: string, behandlungId: string): Zahlung[] {
    return zahlungen
        .filter(
            (z) =>
                z.patient_id === patientId
                && z.behandlung_id === behandlungId
                && zahlCountsTowardPaid(z.status),
        )
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function zahlHistoryForUntersuchung(zahlungen: Zahlung[], patientId: string, untersuchungId: string): Zahlung[] {
    return zahlungen
        .filter(
            (z) =>
                z.patient_id === patientId
                && z.untersuchung_id === untersuchungId
                && zahlCountsTowardPaid(z.status),
        )
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Akten-Referenz für Anzeige: B-Nr. / U-Nr. zuerst (Buchungszeile, nicht Freitext-Kommentar). */
export function buildZahlLinkSelectOptions(
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
): { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [{
        value: "",
        label: "— B-Nr. oder U-Nr. wählen (Zuordnung zur Behandlungs-/Untersuchungszeile) —",
    }];
    for (const b of behandlungen) {
        const bn = (b.behandlungsnummer ?? "").trim();
        const bnr = bn ? `B-Nr. ${bn}` : "B-Nr. — (fehlt)";
        const line = (b.leistungsname || b.beschreibung || b.art || "Behandlung").trim();
        opts.push({ value: `behand:${b.id}`, label: line ? `${bnr} — ${line}` : bnr });
    }
    for (const u of untersuchungen) {
        const un = (u.untersuchungsnummer ?? "").trim();
        const unr = un ? `U-Nr. ${un}` : "U-Nr. — (fehlt)";
        const line = (u.diagnose || "Untersuchung").trim();
        opts.push({ value: `unter:${u.id}`, label: line ? `${unr} — ${line}` : unr });
    }
    return opts;
}

/** Kurzbezeichnung einer Zahlung für Listen (Finanzen / Historie) — über B-Nr. bzw. U-Nr. */
export function formatZahlungBezugLine(
    z: Zahlung,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
): string {
    if (z.behandlung_id) {
        const b = behandlungen.find((x) => x.id === z.behandlung_id);
        const nr = b?.behandlungsnummer?.trim() || "—";
        const sub = b ? (b.leistungsname || b.beschreibung || b.art || "").trim() : "";
        return sub ? `B-Nr. ${nr} — ${sub}` : `B-Nr. ${nr}`;
    }
    if (z.untersuchung_id) {
        const u = untersuchungen.find((x) => x.id === z.untersuchung_id);
        const nr = u?.untersuchungsnummer?.trim() || "—";
        const sub = u?.diagnose?.trim() || "";
        return sub ? `U-Nr. ${nr} — ${sub}` : `U-Nr. ${nr}`;
    }
    return "Ohne B/U-Zeile";
}
