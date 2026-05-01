/**
 * Benannte Arbeits-/Pausen-Regeln (PlanPreference): Arbeit / Pause, Gültigkeit, Kaskade — UI: „Arbeits- & Pausenregeln“.
 */
import { addDays, endOfMonth, format, getISODay, parseISO, startOfDay, startOfWeek } from "date-fns";

function parseYmd(s: string): Date {
    return parseISO(s.length >= 10 ? s.slice(0, 10) : s);
}
function ymdFmt(d: Date): string {
    return format(d, "yyyy-MM-dd");
}
function weekStartMonday(d: Date): Date {
    return startOfWeek(d, { weekStartsOn: 1 });
}
function isoWeekdayFromYmd(dateStr: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
    return getISODay(parseYmd(dateStr)) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export type PlanScopeType =
    | "general" /** alle passenden Tage laut Wochentagen */
    | "day"
    | "week"
    | "month"
    | "period";

/** periodUnit nur bei scope=period: Schritt/Interpretation des Zeitraums (Tag/Woche/Monat im Raster) */
export type PlanPeriodUnit = "day" | "week" | "month";

export type PlanPreference = {
    id: string;
    name: string;
    /** leer = alle Mitarbeiter; sonst nur diese */
    personalIds: string[];
    kind: "work" | "break";
    /** kaskadieren: niedrigeres layer = allgemeiner; höheres = spezifischer und setzt in Überschneidung an */
    layer: number;
    parentId: string | null;
    startMin: number;
    endMin: number;
    scopeType: PlanScopeType;
    /** Mo–So: z.B. [1,2,3,4,5] für Werktag; bei allgemein / period relevant */
    weekdays: (1 | 2 | 3 | 4 | 5 | 6 | 7)[];
    date?: string; /** YYYY-MM bei scope=day */
    weekAnchor?: string; /** beliebiger Tag in der Woche, Montag abgeleitet */
    year?: number; /** bei month */
    month?: number; /** 1–12 */
    periodFrom?: string;
    periodTo?: string;
    periodUnit?: PlanPeriodUnit;
};

export type CalendarSegment = {
    startMin: number;
    endMin: number;
    kind: "work" | "break";
    sourceId: string;
    layer: number;
};

function compareYmd(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

/** Liegt ymd in der Gültigkeit der Präferenz? */
export function preferenceAppliesToDate(p: PlanPreference, ymdStr: string): boolean {
    const wd = isoWeekdayFromYmd(ymdStr) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    if (p.scopeType === "day") {
        return p.date === ymdStr;
    }
    if (p.scopeType === "week" && p.weekAnchor) {
        const mon = ymdFmt(weekStartMonday(startOfDay(parseYmd(p.weekAnchor))));
        const wEnd = ymdFmt(addDays(parseYmd(mon), 6));
        return compareYmd(ymdStr, mon) >= 0 && compareYmd(ymdStr, wEnd) <= 0;
    }
    if (p.scopeType === "month" && p.year != null && p.month != null) {
        const m0 = p.month - 1;
        const d = parseYmd(`${p.year}-${String(m0 + 1).padStart(2, "0")}-01`);
        const first = ymdFmt(d);
        const last = ymdFmt(endOfMonth(d));
        return compareYmd(ymdStr, first) >= 0 && compareYmd(ymdStr, last) <= 0;
    }
    if (p.scopeType === "period" && p.periodFrom && p.periodTo) {
        if (compareYmd(ymdStr, p.periodFrom) < 0 || compareYmd(ymdStr, p.periodTo) > 0) {
            return false;
        }
        if (p.weekdays.length > 0 && !p.weekdays.includes(wd)) {
            return false;
        }
        return true;
    }
    if (p.scopeType === "general") {
        if (p.weekdays.length > 0 && !p.weekdays.includes(wd)) {
            return false;
        }
        return true;
    }
    return false;
}

function preferenceAppliesToPerson(p: PlanPreference, personalId: string): boolean {
    if (p.personalIds.length === 0) return true;
    return p.personalIds.includes(personalId);
}

function mergeByLayer(
    segments: Array<{ a: number; b: number; kind: "work" | "break"; layer: number; id: string }>,
): Array<{ a: number; b: number; kind: "work" | "break"; sourceId: string; layer: number }> {
    /* ~O(k²) über Grenzpunkte k — bei üblichen Regelanzahlen (<50) vernachlässigbar. */
    if (segments.length === 0) return [];
    const ev = new Set<number>();
    for (const s of segments) {
        ev.add(s.a);
        ev.add(s.b);
    }
    const points = [...ev].sort((x, y) => x - y);
    const out: Array<{ a: number; b: number; kind: "work" | "break"; sourceId: string; layer: number }> = [];
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]!;
        const b = points[i + 1]!;
        if (a === b) continue;
        let best: (typeof segments)[0] | null = null;
        for (const s of segments) {
            if (s.a <= a && s.b >= b) {
                if (!best || s.layer > best.layer) best = s;
            }
        }
        if (best) {
            const outSeg = { a, b, kind: best.kind, sourceId: best.id, layer: best.layer };
            const L = out.length;
            if (L > 0) {
                const last = out[L - 1]!;
                if (last.b === a && last.sourceId === outSeg.sourceId && last.kind === outSeg.kind) {
                    last.b = b;
                    continue;
                }
            }
            out.push({
                a: outSeg.a,
                b: outSeg.b,
                kind: outSeg.kind,
                sourceId: outSeg.sourceId,
                layer: outSeg.layer,
            });
        }
    }
    return out;
}

/** Eine feine Aufteilung: höheres layer gewinnt in Überschneidung */
export function resolveSegmentsForPersonDay(
    personalId: string,
    ymdStr: string,
    prefs: PlanPreference[],
): CalendarSegment[] {
    const segs: Array<{ a: number; b: number; kind: "work" | "break"; layer: number; id: string }> = [];
    for (const p of prefs) {
        if (!preferenceAppliesToPerson(p, personalId) || !preferenceAppliesToDate(p, ymdStr)) {
            continue;
        }
        if (p.endMin <= p.startMin) continue;
        segs.push({ a: p.startMin, b: p.endMin, kind: p.kind, layer: p.layer, id: p.id });
    }
    if (segs.length === 0) return [];
    return mergeByLayer(segs).map((m) => ({
        startMin: m.a,
        endMin: m.b,
        kind: m.kind,
        sourceId: m.sourceId,
        layer: m.layer,
    }));
}

/** Pausen von Arbeits-Minuten abziehen (pro Tag) – grobe Näherung: Minuten-Intervalle */
export function subtractBreakFromWork(
    work: Array<[number, number]>,
    br: Array<[number, number]>,
): Array<[number, number]> {
    if (work.length === 0) return [];
    if (br.length === 0) return work;
    const breaks = mergeIntervals(br);
    const mergedW = mergeIntervals(work);
    const net: Array<[number, number]> = [];
    for (const [ws, we] of mergedW) {
        let rem: Array<[number, number]> = [[ws, we]];
        for (const [bs, be] of breaks) {
            const next: Array<[number, number]> = [];
            for (const [a, b] of rem) {
                if (be <= a || bs >= b) {
                    next.push([a, b]);
                } else {
                    if (a < bs) next.push([a, Math.min(bs, b)]);
                    if (be < b) next.push([Math.max(be, a), b]);
                }
            }
            rem = next.filter(([x, y]) => y > x);
        }
        net.push(...rem);
    }
    return net;
}

function mergeIntervals(iv: Array<[number, number]>): Array<[number, number]> {
    if (iv.length === 0) return [];
    const s = [...iv].sort((a, b) => a[0]! - b[0]!);
    const o: Array<[number, number]> = [[s[0]![0], s[0]![1]]];
    for (let i = 1; i < s.length; i++) {
        const [a, b] = s[i]!;
        const L = o[o.length - 1]!;
        if (a <= L[1]) {
            L[1] = Math.max(L[1], b);
        } else o.push([a, b]);
    }
    return o;
}

export function buildNetWorkForDay(
    personalId: string,
    ymdStr: string,
    prefs: PlanPreference[],
): { workRaw: [number, number][]; breakRaw: [number, number][]; net: [number, number][]; resolved: CalendarSegment[] } {
    const resolved = resolveSegmentsForPersonDay(personalId, ymdStr, prefs);
    const work: [number, number][] = [];
    const br: [number, number][] = [];
    for (const r of resolved) {
        if (r.kind === "work") {
            work.push([r.startMin, r.endMin]);
        } else {
            br.push([r.startMin, r.endMin]);
        }
    }
    const wMerge = mergeIntervals(work);
    const bMerge = mergeIntervals(br);
    const net = subtractBreakFromWork(wMerge, bMerge);
    return { workRaw: wMerge, breakRaw: bMerge, net, resolved };
}

export function defaultLayerForScope(scope: PlanScopeType): number {
    switch (scope) {
        case "general":
            return 0;
        case "week":
            return 20;
        case "month":
            return 30;
        case "period":
            return 40;
        case "day":
            return 100;
        default:
            return 10;
    }
}

/** `proposedParentId` ließe einen Zyklus über `parentId`-Ketten zu (oder die Kette ist bereits zyklisch). */
export function preferenceParentWouldCycle(
    editingId: string | undefined,
    proposedParentId: string | null,
    allPrefs: PlanPreference[],
): boolean {
    if (!proposedParentId || !editingId) return false;
    let cur: string | null = proposedParentId;
    const seen = new Set<string>();
    while (cur) {
        if (cur === editingId) return true;
        if (seen.has(cur)) return true;
        seen.add(cur);
        const row = allPrefs.find((p) => p.id === cur);
        cur = row?.parentId ?? null;
    }
    return false;
}

/**
 * Automatische Kaskade: wählt eine „Basis“-Regel mit **breiterer** Geltung (niedrigerer `defaultLayerForScope`)
 * und gleicher Art; sonst mit breiterer Geltung beliebiger Art. Kein Vorgänger für reine „Allgemein“-Regeln.
 */
export function inferAutoParentId(
    draft: { scopeType: PlanScopeType; kind: "work" | "break" },
    allPrefs: PlanPreference[],
    editingId: string | undefined,
): string | null {
    const dLayer = defaultLayerForScope(draft.scopeType);
    if (dLayer <= defaultLayerForScope("general")) return null;
    const others = allPrefs.filter((p) => p.id !== editingId);
    if (others.length === 0) return null;
    const sameKind = others.filter(
        (p) => p.kind === draft.kind && defaultLayerForScope(p.scopeType) < dLayer,
    );
    const pick = (cands: PlanPreference[]) => {
        if (cands.length === 0) return null;
        const sorted = [...cands].sort(
            (a, b) =>
                defaultLayerForScope(a.scopeType) - defaultLayerForScope(b.scopeType) ||
                a.name.localeCompare(b.name, "de"),
        );
        return sorted[0]!.id;
    };
    const fromSame = pick(sameKind);
    if (fromSame && !preferenceParentWouldCycle(editingId, fromSame, allPrefs)) return fromSame;
    const anyKind = others.filter((p) => defaultLayerForScope(p.scopeType) < dLayer);
    const fromAny = pick(anyKind);
    if (fromAny && !preferenceParentWouldCycle(editingId, fromAny, allPrefs)) return fromAny;
    return null;
}

export function newPlanPreferenceId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
