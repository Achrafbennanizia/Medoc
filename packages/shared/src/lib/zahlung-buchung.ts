/**
 * Shared logic for payment booking: Kundenleistungen (Patientenakte) and Finanzen → Neue Zahlung.
 */
import type { Behandlung, Untersuchung, Zahlung } from "@/models/types";
import { zahlStatusDisplay as zahlStatusDisplayI18n, zahlungsartLabel as zahlungsartLabelI18n } from "@/lib/finance-order-labels";

type TFn = (key: string) => string;

export const ZAHLUNG_ART_VALUES = ["BAR", "KARTE", "UEBERWEISUNG", "RECHNUNG"] as const;

export function zahlungArtSelectOptions(t: TFn) {
    return ZAHLUNG_ART_VALUES.map((value) => ({
        value,
        label: zahlungsartLabelI18n(value, t),
    }));
}

/** @deprecated Use zahlungArtSelectOptions(t) */
export const ZAHLUNG_ART_SELECT = [
    { value: "BAR", label: "Cash" },
    { value: "KARTE", label: "Card" },
    { value: "UEBERWEISUNG", label: "Bank transfer" },
    { value: "RECHNUNG", label: "Invoice" },
] as const;

/** Status badge display for payment rows (patient Akte + Finanzen). */
export function zahlStatusDisplay(status: string, t: TFn) {
    return zahlStatusDisplayI18n(status, t);
}

export function zahlungsartLabel(art: string, t: TFn): string {
    return zahlungsartLabelI18n(art, t);
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

/** Max allowed amount for new payment on this treatment (target minus already paid). */
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

export function maxNeuZahlungUntersuchung(
    zahlungen: Zahlung[],
    patientId: string,
    untersuchungId: string,
    gesamtkosten: number | null,
): number | null {
    if (gesamtkosten == null || !Number.isFinite(gesamtkosten)) return null;
    if (gesamtkosten <= 0) return 0;
    const paid = sumZahlungenForUntersuchung(zahlungen, patientId, untersuchungId);
    return Math.max(0, roundMoney2(gesamtkosten - paid));
}

export function maxEditZahlungUntersuchung(
    zahlungen: Zahlung[],
    patientId: string,
    untersuchungId: string,
    excludeZahlungId: string,
    gesamtkosten: number | null,
): number | null {
    if (gesamtkosten == null || !Number.isFinite(gesamtkosten)) return null;
    if (gesamtkosten <= 0) return 0;
    const otherPaid = zahlungen
        .filter(
            (x) =>
                x.patient_id === patientId
                && x.untersuchung_id === untersuchungId
                && x.id !== excludeZahlungId
                && zahlCountsTowardPaid(x.status),
        )
        .reduce((s, x) => s + x.betrag, 0);
    return Math.max(0, roundMoney2(gesamtkosten - otherPaid));
}

/** Max amount when editing: target minus all other payments on same line. */
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

/** One assignment (B or U line) with aggregated current state across all bookings. */
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

/** For "Neue Zahlung → Zuordnung": line still open (remaining target or pending/partial bookings). */
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
        const u = _untersuchungen.find((x) => x.id === id);
        const ges =
            u?.gesamtkosten != null && Number.isFinite(u.gesamtkosten) ? u.gesamtkosten : null;
        const rowsU = zahlungen.filter(
            (z) =>
                z.patient_id === patientId && z.untersuchung_id === id && zahlCountsTowardPaid(z.status),
        );
        if (ges != null && ges > ZAHL_EUR_EPS) {
            const maxNeu = maxNeuZahlungUntersuchung(zahlungen, patientId, id, ges);
            return maxNeu != null && maxNeu > ZAHL_EUR_EPS;
        }
        if (rowsU.length === 0) return true;
        return rowsU.some((z) => z.status === "AUSSTEHEND" || z.status === "TEILBEZAHLT");
    }
    return false;
}

/** Assignment selection only for still-open B/U lines (no closed target; without target/U only for pending bookings). */
export function buildOpenZahlLinkSelectOptions(
    zahlungen: Zahlung[],
    patientId: string,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
): { value: string; label: string }[] {
    const all = buildZahlLinkSelectOptions(behandlungen, untersuchungen, t, tp);
    const filtered = all.filter(
        (o) =>
            !o.value
            || zuordnungNochOffenFuerNeueZahlung(zahlungen, patientId, behandlungen, untersuchungen, o.value),
    );
    if (filtered.length <= 1) {
        return [{
            value: "",
            label: t("zahlung.link.no_open_select"),
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

/** Latest booking for an assignment line (for receipt from summary view). */
export function latestZahlungForZuordnungRow(
    row: Pick<ZahlZuordnungSummaryRow, "kind" | "lineId">,
    zahlungen: Zahlung[],
    patientId: string,
): Zahlung | null {
    const filtered = zahlungen.filter(
        (z) =>
            z.patient_id === patientId
            && zahlCountsTowardPaid(z.status)
            && (row.kind === "behand" ? z.behandlung_id === row.lineId : z.untersuchung_id === row.lineId),
    );
    if (filtered.length === 0) return null;
    return filtered.reduce((best, z) => (String(z.created_at) > String(best.created_at) ? z : best));
}

type ZahlLabelFn = (key: string) => string;
type ZahlLabelParamsFn = (key: string, params: Record<string, string | number>) => string;

/** Exactly one row per B/U line: current state (booking sum, open, status). */
export function aggregateZahlungenByZuordnung(
    zahlungen: Zahlung[],
    patientId: string,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
    t?: ZahlLabelFn,
    tp?: ZahlLabelParamsFn,
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
                bezugLine: formatZahlungBezugLine(z, behandlungen, untersuchungen, t, tp),
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
            const pseudoZ: Zahlung = {
                id: acc.lineId,
                patient_id: patientId,
                behandlung_id: acc.lineId,
                betrag: acc.gezahlt,
                zahlungsart: "BAR",
                status: "BEZAHLT",
                leistung_id: null,
                beschreibung: null,
                created_at: acc.latestAt,
            };
            const bezugLine = formatZahlungBezugLine(pseudoZ, behandlungen, untersuchungen, t, tp);
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
            const soll =
                u?.gesamtkosten != null && Number.isFinite(u.gesamtkosten) ? u.gesamtkosten : null;
            const offen =
                soll != null && soll > ZAHL_EUR_EPS ? Math.max(0, roundMoney2(soll - acc.gezahlt)) : null;
            const un = (u?.untersuchungsnummer ?? "").trim();
            const bezugShort = un ? `U ${un}` : "U";
            const pseudoZ: Zahlung = {
                id: acc.lineId,
                patient_id: patientId,
                untersuchung_id: acc.lineId,
                betrag: acc.gezahlt,
                zahlungsart: "BAR",
                status: "BEZAHLT",
                leistung_id: null,
                beschreibung: null,
                created_at: acc.latestAt,
            };
            const bezugLine = formatZahlungBezugLine(pseudoZ, behandlungen, untersuchungen, t, tp);
            rows.push({
                key,
                kind: "unter",
                lineId: acc.lineId,
                bezugShort,
                bezugLine,
                soll,
                gezahlt: acc.gezahlt,
                offen,
                status: deriveAggregateStatus(acc.gezahlt, soll),
                latestAt: acc.latestAt,
            });
        }
    }

    rows.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
    return rows;
}

/** Akte reference for display: B-Nr. / U-Nr. first (booking line, not free-text comment). */
export function buildZahlLinkSelectOptions(
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
): { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [{
        value: "",
        label: t("zahlung.link.select_placeholder"),
    }];
    for (const b of behandlungen) {
        const bn = (b.behandlungsnummer ?? "").trim();
        const bnr = bn ? tp("zahlung.link.b_nr", { nr: bn }) : t("zahlung.link.b_nr_missing");
        const line = (b.leistungsname || b.beschreibung || b.art || t("zahlung.link.behandlung")).trim();
        opts.push({ value: `behand:${b.id}`, label: line ? `${bnr} — ${line}` : bnr });
    }
    for (const u of untersuchungen) {
        const un = (u.untersuchungsnummer ?? "").trim();
        const unr = un ? tp("zahlung.link.u_nr", { nr: un }) : t("zahlung.link.u_nr_missing");
        const line = (u.diagnose || t("zahlung.link.untersuchung")).trim();
        opts.push({ value: `unter:${u.id}`, label: line ? `${unr} — ${line}` : unr });
    }
    return opts;
}

/** Short label for a payment in lists (Finanzen / history) — via B-no. or U-no. */
export function formatZahlungBezugLine(
    z: Zahlung,
    behandlungen: Behandlung[],
    untersuchungen: Untersuchung[],
    t?: ZahlLabelFn,
    tp?: ZahlLabelParamsFn,
): string {
    if (z.behandlung_id) {
        const b = behandlungen.find((x) => x.id === z.behandlung_id);
        const nr = b?.behandlungsnummer?.trim() || "—";
        const sub = b ? (b.leistungsname || b.beschreibung || b.art || "").trim() : "";
        const prefix = t && tp
            ? (nr === "—" ? t("zahlung.link.b_nr_missing") : tp("zahlung.link.b_nr", { nr }))
            : (nr === "—" ? "B-Nr. —" : `B-Nr. ${nr}`);
        return sub ? `${prefix} — ${sub}` : prefix;
    }
    if (z.untersuchung_id) {
        const u = untersuchungen.find((x) => x.id === z.untersuchung_id);
        const nr = u?.untersuchungsnummer?.trim() || "—";
        const sub = u?.diagnose?.trim() || "";
        const prefix = t && tp
            ? (nr === "—" ? t("zahlung.link.u_nr_missing") : tp("zahlung.link.u_nr", { nr }))
            : (nr === "—" ? "U-Nr. —" : `U-Nr. ${nr}`);
        return sub ? `${prefix} — ${sub}` : prefix;
    }
    return t ? t("zahlung.link.no_bu_line") : "Ohne B/U-Zeile";
}
