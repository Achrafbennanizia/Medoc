import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
    addDays,
    addMonths,
    addWeeks,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    parseISO,
    getISOWeek,
    isSameMonth,
    isToday,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { listPersonal } from "../../controllers/personal.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type {
    ArbeitsplanStore,
    ArbeitsplanView,
    PersonalArbeitsBlock,
} from "@/lib/personal-arbeitsplan";
import {
    loadArbeitsplanStore,
    minToLabel,
    newBlockId,
    saveArbeitsplanStore,
    weekDaysMonFirst,
    weekStartMonday,
    ymd,
} from "@/lib/personal-arbeitsplan";
import {
    newComposeEntryId,
    type ArbeitsplanComposeEntry,
    resolveComposeWorkIntervals,
    composeWorkMinutesForDay,
} from "@/lib/arbeitsplan-compose";
import {
    type PlanPreference,
    buildNetWorkForDay,
    resolveSegmentsForPersonDay,
} from "@/lib/arbeitsplan-preferences";
import type { Personal } from "@/models/types";
import { errorMessage } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { Select } from "../components/ui/input";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";

const DND_MIME = "application/x-medoc-arbeitsblock";
/** Maximale sichtbare Timeline-Höhe (px) — Tagesansicht; Woche nutzt horizontale Minizeilen. */
const MAX_TIMELINE_PX = 256;

const ALL_DAYS: Array<1 | 2 | 3 | 4 | 5 | 6 | 7> = [1, 2, 3, 4, 5, 6, 7];
const DAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function fromTimeValue(s: string): { h: number; m: number } | null {
    if (!s) return null;
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    return { h, m: min };
}

function prefsForPerson(prefs: PlanPreference[], pid: string): PlanPreference[] {
    return prefs.filter((p) => (p.personalIds.length === 0 ? true : p.personalIds.includes(pid)));
}

function layoutOverlapBlock(blocks: PersonalArbeitsBlock[]): Map<string, { lane: number; lanes: number }> {
    const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    const laneEnds: number[] = [];
    const result = new Map<string, { lane: number; lanes: number }>();
    for (const b of sorted) {
        let placed = false;
        for (let L = 0; L < laneEnds.length; L++) {
            if (laneEnds[L]! <= b.startMin) {
                laneEnds[L] = b.endMin;
                result.set(b.id, { lane: L, lanes: 0 });
                placed = true;
                break;
            }
        }
        if (!placed) {
            laneEnds.push(b.endMin);
            result.set(b.id, { lane: laneEnds.length - 1, lanes: 0 });
        }
    }
    const maxL = Math.max(1, laneEnds.length);
    for (const [id, v] of result) {
        result.set(id, { lane: v.lane, lanes: maxL });
    }
    return result;
}

type FilterLayer = "work" | "break" | "both" | "net";

function personInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

function xToMin(e: React.DragEvent | React.MouseEvent, el: HTMLDivElement, minD: number, daySpan: number, snapMin: number): number {
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const ratio = r.width > 0 ? x / r.width : 0;
    const raw = minD + ratio * daySpan;
    const s = snapMin;
    return Math.max(minD, Math.min(minD + daySpan - s, Math.round(raw / s) * s));
}

type HSeg = { key: string; left: number; w: number; bg: string };

function horizontalPrefSegments(
    personalId: string,
    ymdStr: string,
    prefs: PlanPreference[],
    kind: FilterLayer,
    minD: number,
    daySpan: number,
): HSeg[] {
    const pp = prefsForPerson(prefs, personalId);
    const out: HSeg[] = [];
    if (kind === "net") {
        const { net } = buildNetWorkForDay(personalId, ymdStr, pp);
        net.forEach(([a, b], i) => {
            out.push({ key: `n-${i}`, left: ((a - minD) / daySpan) * 100, w: ((b - a) / daySpan) * 100, bg: "rgba(34, 197, 94, 0.38)" });
        });
        return out;
    }
    const r = resolveSegmentsForPersonDay(personalId, ymdStr, pp);
    for (const s of r) {
        if (kind === "work" && s.kind !== "work") continue;
        if (kind === "break" && s.kind !== "break") continue;
        if (kind === "both" && s.kind === "break") {
            out.push({ key: s.sourceId + "-b", left: ((s.startMin - minD) / daySpan) * 100, w: ((s.endMin - s.startMin) / daySpan) * 100, bg: "rgba(245, 158, 11, 0.42)" });
        } else if (kind === "both" && s.kind === "work") {
            out.push({ key: s.sourceId + "-w", left: ((s.startMin - minD) / daySpan) * 100, w: ((s.endMin - s.startMin) / daySpan) * 100, bg: "rgba(34, 197, 94, 0.28)" });
        } else {
            const isW = s.kind === "work";
            out.push({
                key: s.sourceId,
                left: ((s.startMin - minD) / daySpan) * 100,
                w: ((s.endMin - s.startMin) / daySpan) * 100,
                bg: isW ? "rgba(34, 197, 94, 0.3)" : "rgba(245, 158, 11, 0.38)",
            });
        }
    }
    return out;
}

type ComposeCalOpts = { use: boolean; focusId: string; entries: ArbeitsplanComposeEntry[] };

function horizontalSegmentsForDay(
    personalId: string,
    ymdStr: string,
    planPreferences: PlanPreference[],
    filterLayer: FilterLayer,
    minD: number,
    daySpan: number,
    compose: ComposeCalOpts | null,
): HSeg[] {
    if (compose && compose.use && compose.focusId === personalId) {
        if (filterLayer === "break") return [];
        const ivs = resolveComposeWorkIntervals(personalId, ymdStr, compose.entries);
        return ivs.map((seg, i) => {
            const left = ((seg[0] - minD) / daySpan) * 100;
            const w = ((seg[1] - seg[0]) / daySpan) * 100;
            if (filterLayer === "net") {
                return { key: `co-n-${i}`, left, w, bg: "rgba(34, 197, 94, 0.38)" };
            }
            if (filterLayer === "both") {
                return { key: `co-b-${i}`, left, w, bg: "rgba(34, 197, 94, 0.28)" };
            }
            return { key: `co-w-${i}`, left, w, bg: "rgba(34, 197, 94, 0.3)" };
        });
    }
    return horizontalPrefSegments(personalId, ymdStr, planPreferences, filterLayer, minD, daySpan);
}

function dayMinutesForPerson(personalId: string, ymdStr: string, prefs: PlanPreference[], kind: FilterLayer): number {
    const pp = prefsForPerson(prefs, personalId);
    const { workRaw, breakRaw, net } = buildNetWorkForDay(personalId, ymdStr, pp);
    const w = workRaw.reduce((s, [a, b]) => s + (b - a), 0);
    const br = breakRaw.reduce((s, [a, b]) => s + (b - a), 0);
    const n = net.reduce((s, [a, b]) => s + (b - a), 0);
    if (kind === "work") return w;
    if (kind === "break") return br;
    if (kind === "net") return n;
    return w + br;
}

function dayMinutesForDisplay(
    personalId: string,
    ymdStr: string,
    prefs: PlanPreference[],
    kind: FilterLayer,
    compose: ComposeCalOpts | null,
): number {
    if (compose && compose.use && compose.focusId === personalId) {
        if (kind === "break") return 0;
        const m = composeWorkMinutesForDay(personalId, ymdStr, compose.entries);
        if (kind === "work" || kind === "net") return m;
        if (kind === "both") return m;
    }
    return dayMinutesForPerson(personalId, ymdStr, prefs, kind);
}

/** Anzeige Soll‑Arbeitsintervalle (Brutto) für die Mitarbeiter-Übersicht */
function formatWorkDayRanges(workRaw: [number, number][]): string {
    if (workRaw.length === 0) return "—";
    return workRaw.map(([a, b]) => `${minToLabel(a)} – ${minToLabel(b)}`).join(" · ");
}

function totalIntervalMinutes(iv: [number, number][]): number {
    return iv.reduce((s, [a, b]) => s + (b - a), 0);
}

/** z. B. 7 h 30 min */
function formatDurationMins(mins: number): string {
    if (mins <= 0) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
}

function composeEntryLine(e: ArbeitsplanComposeEntry): string {
    if (e.kind === "add_range") {
        const wd = e.weekdays.length > 0 ? ` · ${e.weekdays.map((d) => DAY_SHORT[d - 1]).join("·")}` : " · Mo–So";
        return `Arbeit ${e.dateFrom}–${e.dateTo}${wd} · ${minToLabel(e.startMin)}–${minToLabel(e.endMin)}`;
    }
    if (e.kind === "cut_range") {
        return `Frei / Sperre ${e.dateFrom}–${e.dateTo}`;
    }
    return `Arbeit ${e.date} · ${minToLabel(e.startMin)}–${minToLabel(e.endMin)}`;
}

function ArbeitsplanComposeCard(props: {
    people: Personal[];
    focusId: string;
    onFocusId: (id: string) => void;
    useInCalendar: boolean;
    onUseInCalendar: (v: boolean) => void;
    entries: ArbeitsplanComposeEntry[];
    canWrite: boolean;
    onAdd: (e: ArbeitsplanComposeEntry) => void;
    onRemove: (id: string) => void;
}) {
    const {
        people, focusId, onFocusId, useInCalendar, onUseInCalendar, entries, canWrite, onAdd, onRemove,
    } = props;
    const [addOpen, setAddOpen] = useState(false);
    const t = useToastStore((s) => s.add);
    const [df, setDf] = useState(() => format(new Date(), "yyyy-MM-dd"));
    const [dt, setDt] = useState(() => format(addDays(new Date(), 30), "yyyy-MM-dd"));
    const [dDay, setDDay] = useState(() => format(new Date(), "yyyy-MM-dd"));
    const [wds, setWds] = useState<Set<1 | 2 | 3 | 4 | 5 | 6 | 7>>(() => new Set([1, 2, 3, 4, 5]));
    const [tStart, setTStart] = useState("08:00");
    const [tEnd, setTEnd] = useState("17:00");
    const mine = useMemo(() => entries.filter((e) => e.personalId === focusId), [entries, focusId]);

    const parsePair = (a: string, b: string) => {
        const A = fromTimeValue(a);
        const B = fromTimeValue(b);
        if (!A || !B) return null;
        const sm = A.h * 60 + A.m;
        const em = B.h * 60 + B.m;
        if (em <= sm) return null;
        return { startMin: sm, endMin: em };
    };

    const pushAddRange = () => {
        if (!focusId) {
            t("Bitte Mitarbeiter wählen.", "error");
            return;
        }
        const p = parsePair(tStart, tEnd);
        if (!p) {
            t("Uhrzeit ungültig (Ende nach Beginn).", "error");
            return;
        }
        onAdd({
            id: newComposeEntryId(),
            kind: "add_range",
            personalId: focusId,
            dateFrom: df,
            dateTo: dt,
            weekdays: wds.size === 0 || wds.size === 7 ? [] : [...wds].sort((a, b) => a - b),
            startMin: p.startMin,
            endMin: p.endMin,
        });
        t("Eintrag hinzugefügt", "success");
        setAddOpen(false);
    };

    const pushCutRange = () => {
        if (!focusId) {
            t("Bitte Mitarbeiter wählen.", "error");
            return;
        }
        onAdd({
            id: newComposeEntryId(),
            kind: "cut_range",
            personalId: focusId,
            dateFrom: df,
            dateTo: dt,
        });
        t("Sperrzeitraum hinzugefügt", "success");
        setAddOpen(false);
    };

    const pushAddDay = () => {
        if (!focusId) {
            t("Bitte Mitarbeiter wählen.", "error");
            return;
        }
        const p = parsePair(tStart, tEnd);
        if (!p) {
            t("Uhrzeit ungültig (Ende nach Beginn).", "error");
            return;
        }
        onAdd({
            id: newComposeEntryId(),
            kind: "add_day",
            personalId: focusId,
            date: dDay,
            startMin: p.startMin,
            endMin: p.endMin,
        });
        t("Tages-Arbeit hinzugefügt", "success");
        setAddOpen(false);
    };

    return (
        <div className="card arbeitsplan-pref-card">
            <CardHeader
                title="Arbeitsplan bauen"
                subtitle="Einträge hinzufügen (Arbeitszeiten) oder ausschneiden (Sperr-/Freizeiten). Beliebige Reihenfolge — im Kalender rechts erscheint der aufgelöste Soll-Entwurf für die gewählte Person."
            />
            <div className="card-pad" style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                {people.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>Zuerst Mitarbeiter in der Teamliste anlegen.</p>
                ) : (
                    <>
                        <div className="arbeitsplan-settings-row" style={{ flexWrap: "wrap" }}>
                            <Select
                                label="Vorschau-Kalender für"
                                value={focusId}
                                onChange={(e) => onFocusId(e.target.value)}
                                options={people.map((p) => ({ value: p.id, label: p.name }))}
                            />
                            <label className="arbeitsplan-compose-cb" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={useInCalendar}
                                    onChange={(e) => onUseInCalendar(e.target.checked)}
                                />
                                Soll-Entwurf im Kalender (diese Person)
                            </label>
                        </div>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                            {mine.length === 0 ? (
                                <li style={{ fontSize: 12.5, color: "var(--fg-3)" }}>Noch keine Einträge — unten <strong>+ Hinzufügen</strong>.</li>
                            ) : (
                                mine.map((e) => (
                                    <li
                                        key={e.id}
                                        className="row"
                                        style={{ justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12.5, lineHeight: 1.35, padding: "6px 8px", borderRadius: 6, background: "var(--surface-1)" }}
                                    >
                                        <span>
                                            <span style={{ color: e.kind === "cut_range" ? "#B45309" : "var(--accent)", fontWeight: 700, marginRight: 6 }}>{e.kind === "cut_range" ? "−" : "+"}</span>
                                            {composeEntryLine(e)}
                                        </span>
                                        {canWrite ? (
                                            <button type="button" className="btn btn-ghost" style={{ padding: "2px 8px" }} onClick={() => onRemove(e.id)}>Löschen</button>
                                        ) : null}
                                    </li>
                                ))
                            )}
                        </ul>
                        {canWrite ? (
                            <div>
                                <Button type="button" size="sm" onClick={() => setAddOpen((o) => !o)}>+ Hinzufügen</Button>
                                {addOpen ? (
                                    <div style={{ marginTop: 12, padding: 12, border: "1px solid var(--line)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                                        <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>Zeitraum für die ausgewählte Person. «Arbeitszeitraum» = wiederkehrende Sollzeiten; «Sperrzeitraum» = ganze Tage frei; «Einzeltag» = Arbeitszeit an einem Tag.</p>
                                        <div className="arbeitsplan-time-pair" style={{ gap: 8, flexWrap: "wrap" }}>
                                            <div>
                                                <span className="arbeitsplan-settings-group__l" style={{ display: "block" }}>Von</span>
                                                <input type="date" className="input-edit" value={df} onChange={(e) => setDf(e.target.value)} />
                                            </div>
                                            <div>
                                                <span className="arbeitsplan-settings-group__l" style={{ display: "block" }}>Bis</span>
                                                <input type="date" className="input-edit" value={dt} onChange={(e) => setDt(e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <span className="arbeitsplan-settings-group__l" style={{ display: "block", marginBottom: 4 }}>Wochentage (nur Arbeitszeitraum; leer = alle Tage im Zeitraum)</span>
                                            <div className="arbeitsplan-chips" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                {ALL_DAYS.map((d) => {
                                                    const on = wds.has(d);
                                                    return (
                                                        <button
                                                            key={d}
                                                            type="button"
                                                            className={on ? "is-on" : "is-off"}
                                                            onClick={() => setWds((prev) => {
                                                                const n = new Set(prev);
                                                                if (n.has(d)) n.delete(d);
                                                                else n.add(d);
                                                                return n;
                                                            })}
                                                        >{DAY_SHORT[d - 1]}</button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="arbeitstage-range-grid arbeitsplan-uhrzeit-grid" style={{ maxWidth: 360 }}>
                                            <div className="arbeitstage-range-grid__field">
                                                <span className="arbeitstage-range-grid__l">Von</span>
                                                <input type="time" step={300} className="arbeitstage-range-grid__in" value={tStart} onChange={(e) => setTStart(e.target.value)} />
                                            </div>
                                            <div className="arbeitstage-range-grid__field arbeitsplan-uhrzeit-grid__bis">
                                                <span className="arbeitstage-range-grid__l">Bis</span>
                                                <input type="time" step={300} className="arbeitstage-range-grid__in" value={tEnd} onChange={(e) => setTEnd(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                            <Button type="button" variant="secondary" onClick={pushAddRange}>Arbeitszeitraum sichern</Button>
                                            <Button type="button" variant="secondary" onClick={pushCutRange}>Sperrzeitraum</Button>
                                        </div>
                                        <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 10, marginTop: 4 }}>
                                            <span className="arbeitsplan-settings-group__l" style={{ display: "block" }}>Einzeltag (Datum)</span>
                                            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                                                <input type="date" className="input-edit" value={dDay} onChange={(e) => setDDay(e.target.value)} />
                                                <Button type="button" onClick={pushAddDay}>Arbeit an diesem Tag</Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}

export function PersonalArbeitsplanPage() {
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [store, setStore] = useState<ArbeitsplanStore>(loadArbeitsplanStore);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [view, setView] = useState<ArbeitsplanView>("week");
    const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
    const [filterLayer, setFilterLayer] = useState<FilterLayer>("both");
    const [filterPersonSet, setFilterPersonSet] = useState<Set<string> | null>(null);
    const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
    const [dragKey, setDragKey] = useState(0);
    const [dndActiveId, setDndActiveId] = useState<string | null>(null);

    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canWrite = role != null && allowed("personal.write", role);

    const { settings, blocks, planPreferences, composeEntries } = store;
    const [composeFocusId, setComposeFocusId] = useState("");
    const [useComposeInCal, setUseComposeInCal] = useState(true);
    const composeCal: ComposeCalOpts | null = useMemo(
        () => ({ use: useComposeInCal, focusId: composeFocusId, entries: composeEntries }),
        [useComposeInCal, composeFocusId, composeEntries],
    );
    const minD = settings.dayStartMin;
    const maxD = settings.dayEndMin;
    const daySpan = maxD - minD;
    const timeColH = Math.min(daySpan * settings.pxPerMin, MAX_TIMELINE_PX);

    const updateStore = useCallback((u: (p: ArbeitsplanStore) => ArbeitsplanStore) => {
        setStore((prev) => {
            const n = u(prev);
            saveArbeitsplanStore(n);
            return n;
        });
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setPersonal(await listPersonal());
            setStore(loadArbeitsplanStore());
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    useEffect(() => {
        const end = () => setDndActiveId(null);
        window.addEventListener("dragend", end);
        return () => window.removeEventListener("dragend", end);
    }, []);

    const sortedP = useMemo(
        () => [...personal].sort((a, b) => a.name.localeCompare(b.name, "de")),
        [personal],
    );
    useEffect(() => {
        if (sortedP.length === 0) return;
        if (composeFocusId && sortedP.some((p) => p.id === composeFocusId)) return;
        setComposeFocusId(sortedP[0]!.id);
    }, [sortedP, composeFocusId]);

    const activePeople = useMemo(() => {
        if (filterPersonSet == null) return sortedP;
        return sortedP.filter((p) => filterPersonSet.has(p.id));
    }, [sortedP, filterPersonSet]);

    const dayYmd = useMemo(() => ymd(anchor), [anchor]);
    const weekStart = useMemo(() => weekStartMonday(anchor), [anchor]);
    const weekDays = useMemo(() => weekDaysMonFirst(weekStart), [weekStart]);
    const monthStart = useMemo(() => startOfMonth(anchor), [anchor]);
    const monthEnd = useMemo(() => endOfMonth(anchor), [anchor]);
    const monthGridStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 1 }), [monthStart]);
    const monthGridEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 1 }), [monthEnd]);
    const monthDays = useMemo(
        () => eachDayOfInterval({ start: monthGridStart, end: monthGridEnd }),
        [monthGridStart, monthGridEnd],
    );

    const hue = (id: string) => {
        let h = 0;
        for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
        return h;
    };

    const employeeSollForReferenceDay = useMemo(
        () => sortedP.map((p) => {
            if (useComposeInCal && composeFocusId === p.id) {
                const workRaw = resolveComposeWorkIntervals(p.id, dayYmd, composeEntries);
                const netM = workRaw.reduce((s, [a, b]) => s + (b - a), 0);
                return {
                    personal: p,
                    sollArbeit: formatWorkDayRanges(workRaw),
                    pausenMin: 0,
                    nettoMin: netM,
                };
            }
            const { workRaw, breakRaw, net } = buildNetWorkForDay(p.id, dayYmd, planPreferences);
            return {
                personal: p,
                sollArbeit: formatWorkDayRanges(workRaw),
                pausenMin: totalIntervalMinutes(breakRaw),
                nettoMin: totalIntervalMinutes(net),
            };
        }),
        [sortedP, dayYmd, planPreferences, useComposeInCal, composeFocusId, composeEntries],
    );

    const toggleFilterPerson = (id: string) => {
        setFilterPersonSet((s) => {
            const all = new Set(sortedP.map((p) => p.id));
            if (s == null) {
                const n = new Set(all);
                n.delete(id);
                return n;
            }
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            if (n.size === 0) return s;
            if (n.size === all.size) return null;
            return n;
        });
    };

    const yToMin = (e: React.DragEvent, el: HTMLDivElement) => {
        const r = el.getBoundingClientRect();
        const y = e.clientY - r.top;
        const ratio = y / r.height;
        const raw = minD + ratio * daySpan;
        const s = settings.snapMin;
        return Math.max(minD, Math.min(maxD - s, Math.round(raw / s) * s));
    };

    const handleDropCol = (e: React.DragEvent, ymdStr: string, personalId: string, col: HTMLDivElement) => {
        e.preventDefault();
        e.stopPropagation();
        if (!canWrite) return;
        const id = e.dataTransfer.getData(DND_MIME);
        const b = id ? store.blocks.find((x) => x.id === id) : null;
        if (!b) return;
        const duration = b.endMin - b.startMin;
        const start = yToMin(e, col);
        const end = start + duration;
        if (end > maxD) {
            toast(`Außerhalb des Rasters.`, "error");
            return;
        }
        updateStore((s) => ({
            ...s,
            blocks: [...s.blocks.filter((x) => x.id !== id), { ...b, date: ymdStr, personalId, startMin: start, endMin: end }],
        }));
        setDragKey((k) => k + 1);
        toast("Einsatz (Detail) verschoben", "success");
    };

    const handleDropWeekHBar = useCallback((e: React.DragEvent, ymdStr: string, personalId: string, el: HTMLDivElement) => {
        e.preventDefault();
        e.stopPropagation();
        if (!canWrite) return;
        const id = e.dataTransfer.getData(DND_MIME);
        const b = id ? store.blocks.find((x) => x.id === id) : null;
        if (!b) return;
        const duration = b.endMin - b.startMin;
        const start = xToMin(e, el, minD, daySpan, settings.snapMin);
        const end = start + duration;
        if (end > maxD) {
            toast("Außerhalb des Rasters.", "error");
            return;
        }
        updateStore((s) => ({
            ...s,
            blocks: [...s.blocks.filter((x) => x.id !== id), { ...b, date: ymdStr, personalId, startMin: start, endMin: end }],
        }));
        setDragKey((k) => k + 1);
        toast("Einsatz (Detail) verschoben", "success");
    }, [canWrite, store.blocks, minD, daySpan, settings.snapMin, maxD, toast, updateStore]);

    const handleCreateWeekEinsatz = useCallback((e: React.MouseEvent, ymdStr: string, personalId: string, el: HTMLDivElement) => {
        if (!canWrite) return;
        const start = xToMin(e, el, minD, daySpan, settings.snapMin);
        const end = Math.min(maxD, start + 4 * 60);
        if (end <= start) return;
        const id = newBlockId();
        updateStore((s) => ({ ...s, blocks: [...s.blocks, { id, personalId, date: ymdStr, startMin: start, endMin: end, title: "Einsatz" }] }));
        setDragKey((k) => k + 1);
        toast("Einsatz hinzugefügt", "success");
    }, [canWrite, minD, daySpan, settings.snapMin, maxD, toast, updateStore]);

    const periodLabel = useMemo(() => {
        if (view === "day") return format(parseISO(dayYmd), "EEEE, d. MMM yyyy", { locale: de });
        if (view === "week") {
            return `KW ${getISOWeek(weekStart)} · ${format(weekStart, "d. MMM", { locale: de })} – ${format(addDays(weekStart, 6), "d. MMM yyyy", { locale: de })}`;
        }
        return format(anchor, "MMMM yyyy", { locale: de });
    }, [view, dayYmd, weekStart, anchor]);

    if (loading) return <PageLoading label="Arbeitsplan…" />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load()} />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in personal-arbeitsplan-page">
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <VerwaltungBackButton />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h1 className="page-title" style={{ margin: 0 }}>Arbeitsplan & Einsätze</h1>
                    <p className="page-sub" style={{ margin: "4px 0 0" }}>
                        Links legen Sie fest, <strong>wann</strong> das Team arbeiten oder pausieren soll — das erscheint als Soll-Zeiten im Kalender. Rechts der Kalender; <strong>Einsätze</strong> sind die verschiebbaren Blöcke darüber. Filter: Arbeit, Pause, Netto.
                    </p>
                </div>
                <Link to="/personal" className="btn btn-subtle">Teamliste</Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                <ArbeitsplanComposeCard
                    people={sortedP}
                    focusId={composeFocusId}
                    onFocusId={setComposeFocusId}
                    useInCalendar={useComposeInCal}
                    onUseInCalendar={setUseComposeInCal}
                    entries={composeEntries}
                    canWrite={canWrite}
                    onAdd={(e) => {
                        updateStore((s) => ({ ...s, composeEntries: [...s.composeEntries, e] }));
                    }}
                    onRemove={(id) => {
                        updateStore((s) => ({ ...s, composeEntries: s.composeEntries.filter((x) => x.id !== id) }));
                    }}
                />
                </div>
                <div className="card card-pad arbeitsplan-cal-card" style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0, overflow: "hidden" }}>
                    <h2 className="form-section-title" style={{ marginTop: 0, fontSize: 15 }}>Kalender (alle / gefiltert)</h2>
                    <p className="arbeitsplan-cal-preface" style={{ fontSize: 12, color: "var(--fg-3)", margin: 0, lineHeight: 1.35 }}>
                        <strong>Tag</strong> vertikales Raster. <strong>Woche</strong> pro Person: Soll (Regel) + Einsätze pro Tag. <strong>Monat</strong> Stunden-Übersicht. Kein Zusatz-Scroll im Kalenderkörper.
                    </p>
                    <div className="arbeitsplan-cal-panel">
                    <div className="arbeitsplan-filter-bar arbeitsplan-filter-bar--compact" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div className="arbeitsplan-filter-btns" style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, marginRight: 2 }}>Anzeige</span>
                            {(["work", "break", "both", "net"] as const).map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    className={filterLayer === k ? "btn btn-accent arbeitsplan-view-filter" : "btn btn-ghost arbeitsplan-view-filter"}
                                    onClick={() => setFilterLayer(k)}
                                >
                                    {k === "work" ? "Arb." : k === "break" ? "Pause" : k === "both" ? "A+P" : "Netto"}
                                </button>
                            ))}
                        </div>
                        <div>
                            <span className="kpi-label-mini kpi-label-mini--strong kpi-label-mini--block">
                                Personen
                            </span>
                            <div className="arbeitsplan-chips arbeitsplan-chips--compact">
                                <button type="button" className={filterPersonSet == null ? "is-active" : undefined} onClick={() => setFilterPersonSet(null)}>Alle</button>
                                {sortedP.map((p) => {
                                    const on = filterPersonSet == null || filterPersonSet.has(p.id);
                                    return (
                                        <button
                                            key={p.id} type="button" className={on ? "is-on" : "is-off"}
                                            onClick={() => toggleFilterPerson(p.id)}
                                        >{p.name}</button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="arbeitsplan-toolbar arbeitsplan-toolbar--slim" style={{ marginTop: 0 }}>
                        <div className="arbeitsplan-seg" role="tablist" aria-label="Ansicht">
                            {(["day", "week", "month"] as const).map((k) => (
                                <button key={k} type="button" role="tab" className={view === k ? "is-active" : undefined} onClick={() => setView(k)}>
                                    {k === "day" ? "Tag" : k === "week" ? "Woche" : "Monat"}
                                </button>
                            ))}
                        </div>
                        <div className="arbeitsplan-nav">
                            <button type="button" className="btn btn-ghost" onClick={() => {
                                if (view === "day") setAnchor((a) => addDays(a, -1));
                                else if (view === "week") setAnchor((a) => addWeeks(a, -1));
                                else setAnchor((a) => addMonths(a, -1));
                            }}>‹</button>
                            <span className="arbeitsplan-nav__label" style={{ maxWidth: "min(100%, 12rem)", fontSize: 12.5 }}>{periodLabel}</span>
                            <button type="button" className="btn btn-ghost" onClick={() => {
                                if (view === "day") setAnchor((a) => addDays(a, 1));
                                else if (view === "week") setAnchor((a) => addWeeks(a, 1));
                                else setAnchor((a) => addMonths(a, 1));
                            }}>›</button>
                            <button type="button" className="btn btn-subtle" onClick={() => setAnchor(startOfDay(new Date()))}>Heute</button>
                        </div>
                    </div>

                    {sortedP.length === 0 ? (
                        <p style={{ color: "var(--fg-3)" }}>Kein Personal — in <Link to="/personal">Team</Link> Mitarbeiter anlegen.</p>
                    ) : null}

                    {view === "month" && sortedP.length > 0 ? (
                        <ArbeitsplanMonth
                            monthDays={monthDays}
                            monthStart={monthStart}
                            planPreferences={planPreferences}
                            people={activePeople}
                            filterLayer={filterLayer}
                            blocks={blocks}
                            onSelectDay={(d) => { setAnchor(startOfDay(d)); setView("day"); }}
                            composeCal={composeCal}
                        />
                    ) : null}
                    {view === "day" && activePeople.length > 0 ? (
                        <div className="arbeitsplan-cal-embed" key={`d-${dayYmd}-${dragKey}`}>
                            <div
                                className="arbeitsplan-grid arbeitsplan-grid--day"
                                style={{ gridTemplateColumns: `40px repeat(${activePeople.length}, minmax(0, 1fr))` }}
                            >
                                <div className="arbeitsplan-grid__corner" />
                                {activePeople.map((p) => (
                                    <div key={p.id} className="arbeitsplan-day-head">{p.name}</div>
                                ))}
                                <Ruler minD={minD} daySpan={daySpan} timeColH={timeColH} />
                                {activePeople.map((p) => (
                                    <DayColumn
                                        key={p.id} personal={p} ymdStr={dayYmd} planPreferences={planPreferences} blocks={blocks} filterLayer={filterLayer}
                                        minD={minD} daySpan={daySpan} timeColH={timeColH} canWrite={canWrite} hue={hue} composeCal={composeCal}
                                        onDoubleClickEinsatz={() => {
                                            if (!canWrite) return;
                                            const id = newBlockId();
                                            updateStore((s) => ({
                                                ...s,
                                                blocks: [...s.blocks, { id, personalId: p.id, date: dayYmd, startMin: 8 * 60, endMin: 12 * 60, title: "Einsatz" }],
                                            }));
                                            setDragKey((k) => k + 1);
                                        }}
                                        onDrop={(e, el) => handleDropCol(e, dayYmd, p.id, el)}
                                        dndActiveId={dndActiveId} setDndActiveId={setDndActiveId} setDeleteBlockId={setDeleteBlockId}
                                        onDragStart={(e, bid) => { if (canWrite) { e.dataTransfer.setData(DND_MIME, bid); setDndActiveId(bid); } }}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {view === "week" && activePeople.length > 0 ? (
                        <div className="arbeitsplan-cal-embed" key={`w-${getISOWeek(weekStart)}-${dragKey}`}>
                            <div className="arbeitsplan-week-matrix" role="grid" aria-label="Wochenübersicht je Person und Tag">
                                <div className="arbeitsplan-week-matrix__corner" aria-hidden>Person / Tag</div>
                                {weekDays.map((d) => {
                                    const y = ymd(d);
                                    return (
                                        <div key={y} className="arbeitsplan-week-matrix__dhead">
                                            <span className="arbeitsplan-week-matrix__dow">{format(d, "EEE", { locale: de })}</span>
                                            <span className="arbeitsplan-week-matrix__dnum">{format(d, "d. MMM", { locale: de })}</span>
                                        </div>
                                    );
                                })}
                                {activePeople.map((p) => (
                                    <Fragment key={p.id}>
                                        <div className="arbeitsplan-week-matrix__rhead" title={p.name}>
                                            <span className="arbeitsplan-week-matrix__rinit">{personInitials(p.name)}</span>
                                            <span className="arbeitsplan-week-matrix__rname">{p.name}</span>
                                        </div>
                                        {weekDays.map((d) => {
                                            const y = ymd(d);
                                            return (
                                                <WeekPersonDayHBar
                                                    key={`${p.id}-${y}`}
                                                    personal={p}
                                                    ymdStr={y}
                                                    planPreferences={planPreferences}
                                                    filterLayer={filterLayer}
                                                    blocks={blocks}
                                                    minD={minD}
                                                    daySpan={daySpan}
                                                    canWrite={canWrite}
                                                    hueN={hue(p.id)}
                                                    dndActiveId={dndActiveId}
                                                    setDndActiveId={setDndActiveId}
                                                    onDropCell={(e, el) => handleDropWeekHBar(e, y, p.id, el)}
                                                    onDblClickCell={(e, el) => handleCreateWeekEinsatz(e, y, p.id, el)}
                                                    onBlockDel={setDeleteBlockId}
                                                    onDragStartBlock={(e, id) => { e.dataTransfer.setData(DND_MIME, id); setDndActiveId(id); }}
                                                    composeCal={composeCal}
                                                />
                                            );
                                        })}
                                    </Fragment>
                                ))}
                            </div>
                            <p className="arbeitsplan-week-hint" style={{ fontSize: 10.5, color: "var(--fg-3)", margin: "6px 0 0", lineHeight: 1.3 }}>
                                Zeitachse: links früh, rechts spät ({minToLabel(minD)} – {minToLabel(maxD)}). Doppelklick = Einsatz. Ziehen = verschieben.
                            </p>
                        </div>
                    ) : null}
                    </div>
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="form-section-title" style={{ marginTop: 0 }}>Arbeitszeiten der Mitarbeiter (Soll)</h2>
                <div className="arbeitsplan-table-wrap">
                    {sortedP.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 13 }}>Keine Mitarbeiter in der Teamliste.</p>
                    ) : (
                        <table className="tbl arbeitsplan-tbl" style={{ width: "100%", fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th>Mitarbeiter</th>
                                    <th>Soll (Arbeit)</th>
                                    <th>Pausen</th>
                                    <th>Netto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employeeSollForReferenceDay.map((row) => (
                                    <tr key={row.personal.id} className="arbeitsplan-employee-soll__row">
                                        <td>
                                            <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{row.personal.name}</span>
                                        </td>
                                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{row.sollArbeit}</td>
                                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatDurationMins(row.pausenMin)}</td>
                                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatDurationMins(row.nettoMin)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={deleteBlockId != null}
                onClose={() => setDeleteBlockId(null)}
                onConfirm={() => { if (deleteBlockId) updateStore((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== deleteBlockId) })); setDeleteBlockId(null); toast("Einsatz entfernt", "success"); }}
                title="Einsatz löschen?" message="Dieser Detail-Einsatz (Block) wird entfernt." confirmLabel="Löschen" danger
            />
        </div>
    );
}

function WeekPersonDayHBar({
    personal,
    ymdStr,
    planPreferences,
    filterLayer,
    blocks,
    minD,
    daySpan,
    canWrite,
    hueN,
    dndActiveId,
    setDndActiveId,
    onDropCell,
    onDblClickCell,
    onBlockDel,
    onDragStartBlock,
    composeCal,
}: {
    personal: Personal;
    ymdStr: string;
    planPreferences: PlanPreference[];
    filterLayer: FilterLayer;
    blocks: PersonalArbeitsBlock[];
    minD: number;
    daySpan: number;
    canWrite: boolean;
    hueN: number;
    dndActiveId: string | null;
    setDndActiveId: (s: string | null) => void;
    onDropCell: (e: React.DragEvent, el: HTMLDivElement) => void;
    onDblClickCell: (e: React.MouseEvent, el: HTMLDivElement) => void;
    onBlockDel: (id: string | null) => void;
    onDragStartBlock: (e: React.DragEvent, id: string) => void;
    composeCal: ComposeCalOpts | null;
}) {
    const myBlocks = useMemo(
        () => blocks.filter((b) => b.date === ymdStr && b.personalId === personal.id),
        [blocks, ymdStr, personal.id],
    );
    const lo = useMemo(() => layoutOverlapBlock(myBlocks), [myBlocks]);
    const segs = useMemo(
        () => horizontalSegmentsForDay(personal.id, ymdStr, planPreferences, filterLayer, minD, daySpan, composeCal),
        [personal.id, ymdStr, planPreferences, filterLayer, minD, daySpan, composeCal],
    );

    return (
        <div
            className="arbeitsplan-week-hbar"
            role="gridcell"
            onDragOver={canWrite ? (e) => e.preventDefault() : undefined}
            onDrop={canWrite ? (e) => { e.preventDefault(); onDropCell(e, e.currentTarget as HTMLDivElement); } : undefined}
            onDoubleClick={canWrite ? (e) => onDblClickCell(e, e.currentTarget as HTMLDivElement) : undefined}
        >
            <div className="arbeitsplan-week-hbar__track">
                <div className="arbeitsplan-week-hbar__prefs">
                    {segs.map((s) => (
                        <div
                            key={s.key}
                            className="arbeitsplan-hor-seg"
                            style={{ left: `${s.left}%`, width: `${Math.max(0.35, s.w)}%`, background: s.bg }}
                        />
                    ))}
                </div>
                <div className="arbeitsplan-week-hbar__eins">
                    {myBlocks.map((b) => {
                        const L = lo.get(b.id);
                        const lanes = Math.max(1, L?.lanes ?? 1);
                        const lane = L?.lane ?? 0;
                        const laneH = 100 / lanes;
                        return (
                            <button
                                key={b.id}
                                type="button"
                                draggable={canWrite}
                                onDoubleClick={(e) => e.stopPropagation()}
                                onDragStart={(e) => onDragStartBlock(e, b.id)}
                                onDragEnd={() => setDndActiveId(null)}
                                className="arbeitsplan-block-h"
                                style={{
                                    left: `${((b.startMin - minD) / daySpan) * 100}%`,
                                    width: `${Math.max(1, ((b.endMin - b.startMin) / daySpan) * 100)}%`,
                                    top: `${lane * laneH}%`,
                                    height: `${laneH * 0.9}%`,
                                    borderColor: `hsla(${hueN}, 50%, 34%, 0.6)`,
                                    background: `hsla(${hueN}, 52%, 46%, 0.32)`,
                                    pointerEvents: dndActiveId ? "none" : "auto",
                                }}
                                title={`${b.title} · ${minToLabel(b.startMin)}–${minToLabel(b.endMin)}`}
                            >
                                <span className="arbeitsplan-block-h__lbl">{b.title}</span>
                                {canWrite ? (
                                    <span
                                        className="arbeitsplan-block-h__x"
                                        onClick={(ev) => { ev.stopPropagation(); onBlockDel(b.id); }}
                                        onKeyDown={(ev) => ev.stopPropagation()}
                                    >×</span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Ruler({ minD, daySpan, timeColH }: { minD: number; daySpan: number; timeColH: number }) {
    const ticks: number[] = [];
    for (let m = Math.floor(minD / 60) * 60; m <= minD + daySpan; m += 60) {
        ticks.push(m);
    }
    return (
        <div className="arbeitsplan-ruler" style={{ minHeight: timeColH, gridRow: 2, gridColumn: 1 }}>
            {ticks.map((m) => (
                <div key={m} className="arbeitsplan-ruler__tick" style={{ top: ((m - minD) / daySpan) * 100 + "%" }}>
                    {Math.floor(m / 60)}:00
                </div>
            ))}
        </div>
    );
}

function WeekAggregateSegments({ ymdStr, people, prefs, kind, minD, daySpan, composeCal }: {
    ymdStr: string;
    people: Personal[];
    prefs: PlanPreference[];
    kind: FilterLayer;
    minD: number;
    daySpan: number;
    composeCal: ComposeCalOpts | null;
}) {
    const segs: Array<{ top: number; h: number; c: string }> = [];
    for (const person of people) {
        if (composeCal && composeCal.use && composeCal.focusId === person.id) {
            if (kind === "break") {
                /* keine Pausen im Plan-Bau-Entwurf */
            } else {
                const ivs = resolveComposeWorkIntervals(person.id, ymdStr, composeCal.entries);
                for (const [a, b] of ivs) {
                    const c = kind === "net" ? "rgba(34, 197, 94, 0.25)" : "rgba(34, 197, 94, 0.18)";
                    segs.push({ top: ((a - minD) / daySpan) * 100, h: ((b - a) / daySpan) * 100, c });
                }
            }
            continue;
        }
        const pp = prefsForPerson(prefs, person.id);
        if (kind === "net") {
            const { net } = buildNetWorkForDay(person.id, ymdStr, pp);
            for (const [a, b] of net) {
                segs.push({ top: ((a - minD) / daySpan) * 100, h: ((b - a) / daySpan) * 100, c: "rgba(34, 197, 94, 0.25)" });
            }
            continue;
        }
        const r = resolveSegmentsForPersonDay(person.id, ymdStr, pp);
        for (const s of r) {
            if (kind === "work" && s.kind !== "work") continue;
            if (kind === "break" && s.kind !== "break") continue;
            const c = s.kind === "work" ? "rgba(34, 197, 94, 0.18)" : "rgba(245, 158, 11, 0.22)";
            segs.push({ top: ((s.startMin - minD) / daySpan) * 100, h: ((s.endMin - s.startMin) / daySpan) * 100, c });
        }
    }
    return (
        <>
            {segs.map((s, i) => (
                <div
                    key={i}
                    className="arbeitsplan-agg"
                    style={{
                        top: s.top + "%",
                        height: s.h + "%",
                        background: s.c,
                        position: "absolute",
                        left: 0,
                        right: 0,
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
            ))}
        </>
    );
}

const MONTH_CAL_EVT: Array<"green" | "blue" | "accent" | "orange" | "purple"> = ["green", "blue", "accent", "orange", "purple"];

function monthCalEvtClass(personalId: string, people: Personal[]): (typeof MONTH_CAL_EVT)[number] {
    const i = people.findIndex((p) => p.id === personalId);
    return MONTH_CAL_EVT[(i >= 0 ? i : 0) % MONTH_CAL_EVT.length]!;
}

function ArbeitsplanMonth({ monthDays, monthStart, planPreferences, people, filterLayer, blocks, onSelectDay, composeCal }: {
    monthDays: Date[];
    monthStart: Date;
    planPreferences: PlanPreference[];
    people: Personal[];
    filterLayer: FilterLayer;
    blocks: PersonalArbeitsBlock[];
    onSelectDay: (d: Date) => void;
    composeCal: ComposeCalOpts | null;
}) {
    const label = filterLayer === "net" ? "Netto" : filterLayer === "work" ? "Arbeit" : filterLayer === "break" ? "Pause" : "Arb.+Pau.";
    const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

    return (
        <div className="cal arbeitsplan-month-cal animate-fade-in" style={{ animationDuration: "240ms" }}>
            {DAY_SHORT.map((d) => (
                <div key={d} className="cal-head">
                    {d}
                </div>
            ))}
            {monthDays.map((d) => {
                const y = ymd(d);
                const inM = isSameMonth(d, monthStart);
                const sumMin = people.reduce((s, p) => s + dayMinutesForDisplay(p.id, y, planPreferences, filterLayer, composeCal), 0);
                const dayBlocks = [...blocks]
                    .filter((b) => b.date === y && personById.has(b.personalId))
                    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
                const visible = dayBlocks.slice(0, 3);
                const more = dayBlocks.length - visible.length;
                const showSollOnly = dayBlocks.length === 0 && sumMin > 0 && inM;
                const empty = dayBlocks.length === 0 && sumMin <= 0 && inM;

                return (
                    <div
                        key={y}
                        role="button"
                        tabIndex={0}
                        className={["cal-cell", !inM ? "dim" : "", isToday(d) ? "today" : ""].filter(Boolean).join(" ")}
                        onClick={() => onSelectDay(d)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelectDay(d);
                            }
                        }}
                        title={
                            dayBlocks.length
                                ? dayBlocks.map((b) => `${minToLabel(b.startMin)} ${b.title}`).join(" · ")
                                : sumMin > 0
                                    ? `${label} ${(Math.round((sumMin / 60) * 10) / 10).toString().replace(".", ",")} h`
                                    : undefined
                        }
                    >
                        <div className="cal-num">{format(d, "d")}</div>
                        {visible.map((b) => {
                            const p = personById.get(b.personalId);
                            const initials = p ? personInitials(p.name) : "?";
                            const tone = monthCalEvtClass(b.personalId, people);
                            return (
                                <div
                                    key={b.id}
                                    className={`cal-evt ${tone}`}
                                    style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectDay(d);
                                    }}
                                >
                                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{minToLabel(b.startMin)}</span>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                                        {b.title}
                                        {p ? ` · ${initials}` : ""}
                                    </span>
                                </div>
                            );
                        })}
                        {more > 0 ? (
                            <div style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, padding: "2px 4px" }}>
                                +{more} weitere
                            </div>
                        ) : null}
                        {showSollOnly ? (
                            <button
                                type="button"
                                className="cal-evt grey"
                                style={{
                                    cursor: "pointer",
                                    display: "block",
                                    width: "100%",
                                    border: "none",
                                    background: "none",
                                    font: "inherit",
                                    textAlign: "inherit",
                                    padding: 0,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectDay(d);
                                }}
                            >
                                {label} {`${Math.round((sumMin / 60) * 10) / 10}`.replace(".", ",")} h
                            </button>
                        ) : null}
                        {empty ? <div style={{ fontSize: 11, color: "var(--fg-4)", padding: "2px 4px" }}>—</div> : null}
                    </div>
                );
            })}
        </div>
    );
}

function DayColumn({ personal, ymdStr, planPreferences, blocks, filterLayer, minD, daySpan, timeColH, canWrite, hue, composeCal, onDoubleClickEinsatz, onDrop, dndActiveId, setDndActiveId, setDeleteBlockId, onDragStart }: {
    personal: Personal; ymdStr: string; planPreferences: PlanPreference[]; blocks: PersonalArbeitsBlock[]; filterLayer: FilterLayer; minD: number; daySpan: number; timeColH: number;
    canWrite: boolean; hue: (id: string) => number; composeCal: ComposeCalOpts | null;
    onDoubleClickEinsatz: () => void; onDrop: (e: React.DragEvent, el: HTMLDivElement) => void; dndActiveId: string | null; setDndActiveId: (s: string | null) => void; setDeleteBlockId: (s: string | null) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
}) {
    const lo = layoutOverlapBlock(blocks.filter((b) => b.date === ymdStr && b.personalId === personal.id));
    return (
        <div
            className="arbeitsplan-col" onDragOver={canWrite ? (e) => e.preventDefault() : undefined} onDrop={canWrite ? (e) => onDrop(e, e.currentTarget as HTMLDivElement) : undefined}
        >
            <div className="arbeitsplan-col__inner" style={{ minHeight: timeColH, position: "relative" }}>
                {filterLayer === "net" || filterLayer === "both" || filterLayer === "work" || filterLayer === "break" ? (
                    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
                        <WeekAggregateSegments ymdStr={ymdStr} people={[personal]} prefs={planPreferences} kind={filterLayer} minD={minD} daySpan={daySpan} composeCal={composeCal} />
                    </div>
                ) : null}
                <div className="arbeitsplan-col__grid" style={{ minHeight: timeColH }} onDoubleClick={onDoubleClickEinsatz} />
                {blocks.filter((b) => b.date === ymdStr && b.personalId === personal.id).map((b) => (
                    <Block
                        key={b.id} b={b} minD={minD} daySpan={daySpan} lo={lo.get(b.id)} dnd={dndActiveId} canWrite={canWrite} hue={hue(b.personalId)}
                        onDel={() => setDeleteBlockId(b.id)} onDragStart={(e) => onDragStart(e, b.id)} onDragEnd={() => setDndActiveId(null)}
                    />
                ))}
            </div>
        </div>
    );
}

function Block({ b, minD, daySpan, lo, dnd, canWrite, onDel, onDragStart, onDragEnd, hue }: {
    b: PersonalArbeitsBlock; minD: number; daySpan: number; lo?: { lane: number; lanes: number }; dnd: string | null; canWrite: boolean; onDel: () => void;
    onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; hue: number;
}) {
    const w = lo && lo.lanes > 1 ? 100 / lo.lanes : 100;
    const left = lo ? (lo.lane * 100) / lo.lanes : 0;
    const st: CSSProperties = {
        top: ((b.startMin - minD) / daySpan) * 100 + "%",
        height: ((b.endMin - b.startMin) / daySpan) * 100 + "%",
        left: left + "%",
        width: w + "%",
        pointerEvents: dnd ? "none" as const : "auto",
        borderColor: `hsla(${hue}, 50%, 36%, 0.45)`,
        background: `hsla(${hue}, 50%, 48%, 0.2)`,
    };
    return (
        <button
            type="button" draggable={canWrite} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={canWrite ? (e) => e.preventDefault() : undefined}
            className="arbeitsplan-block" style={st}
        >
            {minToLabel(b.startMin)} – {minToLabel(b.endMin)} · {b.title}
            {canWrite ? <span className="arbeitsplan-block__del" onClick={(e) => { e.stopPropagation(); onDel(); }}>×</span> : null}
        </button>
    );
}

