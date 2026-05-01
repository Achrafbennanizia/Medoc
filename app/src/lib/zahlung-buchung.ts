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

/** Eine Zuordnung (B- oder U-Zeile) mit zusammengefasstem aktuellen Stand über alle Buchungen. */
export type ZahlZuordnungSummaryRow = {
    key: string;
    kind: "behand" | "unter";
    lineId: string;
    bezugShort: string;
    bezugLine: string;
    soll: number | null;
    gezahlt: number;
    offen: number | null;
    status: Zahlung["status"];
    latestAt: string;
};

function zuordnungKeyBehandlung(id: string): string {
    return `behand:${id}`;
}

function zuordnungKeyUntersuchung(id: string): string {
    return `unter:${id}`;
}

/** Für „Neue Zahlung → Zuordnung“: Zeile noch offen (Rest-Soll oder ausstehende/teilbezahlte Buchungen). */
export function zuordnungNochOffenFuerNeueZahlung(
    zahlungen: Zahlung[],
    patientId: string,
    behandlungen: Behandlung[],
    _untersuchungen: Untersuchung[],
    linkValue: string,
): boolean {
    if (!linkValue.includes(":")) return true;
    const i = linkValue.indexOf(":");
    const kind = linkValue.slice(0, i);
    const id = linkValue.slice(i + 1);
    if (kind === "behand") {
        const bh = behandlungen.find((b) => b.id === id);
        const ges =
            bh?.gesamtkosten != null && Number.isFinite(bh.gesamtkosten) ? bh.gesamtkosten : null;

        const rowsBh = zahlungen.filter(
            (z) =>
                z.patient_id === patientId && z.behandlung_id === id && zahlCountsTowardPaid(z.status),
        );

        if (ges != null && ges > ZAHL_EUR_EPS) {
            const maxNeu = maxNeuZahlungBehandlung(zahlungen, patientId, id, ges);
            return maxNeu != null && maxNeu > ZAHL_EUR_EPS;
        }

        if (rowsBh.length === 0) return true;
        return rowsBh.some((z) => z.status === "AUSSTEHEND" || z.status === "TEILBEZAHLT");
    }
    if (kind === "unter") {
        const rowsU = zahlungen.filter(
            (z) =>
                z.patient_id === patientId && z.untersuchung_id === id && zahlCountsTowardPaid(z.status),
        );
        if (rowsU.length === 0) return true;
        return rowsU.some((z) => z.status === "AUSSTEHEND" || z.status === "TEILBEZAHLT");
    }
    return false;
}

/** Zuordnung-Auswahl nur für noch offene B-/U-Zeilen (kein abgeschlossenes Soll; ohne Soll/U nur bei ausstehenden Buchungen). */
export function buildOpenZahlLinkSelectOptions(
    zahlungen: Zahlung[],
    patientId: string,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
): { value: string; label: string }[] {
    const all = buildZahlLinkSelectOptions(behandlungen, untersuchungen);
    const filtered = all.filter(
        (o) =>
            !o.value
            || zuordnungNochOffenFuerNeueZahlung(zahlungen, patientId, behandlungen, untersuchungen, o.value),
    );
    if (filtered.length <= 1) {
        return [{
            value: "",
            label: "— Keine offene Zuordnung (alle Sollen sind ausgeglichen) —",
        }];
    }
    return filtered;
}

function deriveAggregateStatus(gezahlt: number, soll: number | null): Zahlung["status"] {
    const g = roundMoney2(gezahlt);
    if (soll != null && Number.isFinite(soll) && soll > ZAHL_EUR_EPS) {
        const offen = roundMoney2(soll - g);
        if (offen <= ZAHL_EUR_EPS) return "BEZAHLT";
        if (g <= ZAHL_EUR_EPS) return "AUSSTEHEND";
        return "TEILBEZAHLT";
    }
    if (g > ZAHL_EUR_EPS) return "BEZAHLT";
    return "AUSSTEHEND";
}

/** Pro B-/U-Zeile genau eine Zeile: aktueller Stand (Summe Buchungen, offen, Status). */
export function aggregateZahlungenByZuordnung(
    zahlungen: Zahlung[],
    patientId: string,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
): ZahlZuordnungSummaryRow[] {
    type Acc = {
        kind: "behand" | "unter";
        lineId: string;
        gezahlt: number;
        latestAt: string;
    };
    const map = new Map<string, Acc>();

    for (const z of zahlungen) {
        if (z.patient_id !== patientId || !zahlCountsTowardPaid(z.status)) continue;
        let key: string | null = null;
        let kind: "behand" | "unter" | null = null;
        let lineId: string | null = null;
        if (z.behandlung_id) {
            key = zuordnungKeyBehandlung(z.behandlung_id);
            kind = "behand";
            lineId = z.behandlung_id;
        } else if (z.untersuchung_id) {
            key = zuordnungKeyUntersuchung(z.untersuchung_id);
            kind = "unter";
            lineId = z.untersuchung_id;
        } else {
            key = `solo:${z.id}`;
            kind = "behand";
            lineId = z.id;
        }
        const prev = map.get(key);
        const bet = z.betrag;
        const at = z.created_at;
        if (!prev) {
            map.set(key, { kind: kind!, lineId: lineId!, gezahlt: bet, latestAt: at });
        } else {
            prev.gezahlt = roundMoney2(prev.gezahlt + bet);
            if (at.localeCompare(prev.latestAt) > 0) prev.latestAt = at;
        }
    }

    const rows: ZahlZuordnungSummaryRow[] = [];
    for (const [key, acc] of map) {
        if (key.startsWith("solo:")) {
            const z = zahlungen.find((x) => x.id === acc.lineId);
            if (!z) continue;
            rows.push({
                key,
                kind: "behand",
                lineId: acc.lineId,
                bezugShort: "—",
                bezugLine: "Ohne B/U-Zeile",
                soll: null,
                gezahlt: acc.gezahlt,
                offen: null,
                status: z.status as Zahlung["status"],
                latestAt: acc.latestAt,
            });
            continue;
        }
        if (acc.kind === "behand") {
            const b = behandlungen.find((x) => x.id === acc.lineId);
            const soll =
                b?.gesamtkosten != null && Number.isFinite(b.gesamtkosten) ? b.gesamtkosten : null;
            const offen =
                soll != null && soll > ZAHL_EUR_EPS ? Math.max(0, roundMoney2(soll - acc.gezahlt)) : null;
            const bn = (b?.behandlungsnummer ?? "").trim();
            const bezugShort = bn ? `B ${bn}` : "B";
            const nr = bn || "—";
            const sub = (b ? (b.leistungsname || b.beschreibung || b.art || "") : "").trim();
            const bezugLine = sub ? `B-Nr. ${nr} — ${sub}` : `B-Nr. ${nr}`;
            rows.push({
                key,
                kind: "behand",
                lineId: acc.lineId,
                bezugShort,
                bezugLine,
                soll,
                gezahlt: acc.gezahlt,
                offen,
                status: deriveAggregateStatus(acc.gezahlt, soll),
                latestAt: acc.latestAt,
            });
        } else {
            const u = untersuchungen.find((x) => x.id === acc.lineId);
            const un = (u?.untersuchungsnummer ?? "").trim();
            const bezugShort = un ? `U ${un}` : "U";
            const line = (u?.diagnose || "Untersuchung").trim();
            const bezugLine = un ? `U-Nr. ${un} — ${line}` : `U-Nr. — (fehlt)${line ? ` — ${line}` : ""}`;
            rows.push({
                key,
                kind: "unter",
                lineId: acc.lineId,
                bezugShort,
                bezugLine,
                soll: null,
                gezahlt: acc.gezahlt,
                offen: null,
                status: deriveAggregateStatus(acc.gezahlt, null),
                latestAt: acc.latestAt,
            });
        }
    }

    rows.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
    return rows;
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
