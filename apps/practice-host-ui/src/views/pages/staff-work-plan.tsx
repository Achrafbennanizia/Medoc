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
import { listStaff } from "@/systems/practice-host/controllers/staff.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type {
    WorkPlanStore,
    WorkPlanView,
    StaffWorkBlock,
} from "@/lib/staff-work-plan";
import {
    loadWorkPlanStore,
    minToLabel,
    newBlockId,
    saveWorkPlanStore,
    weekDaysMonFirst,
    weekStartMonday,
    ymd,
} from "@/lib/staff-work-plan";
import {
    newComposeEntryId,
    parseComposeEntries,
    type WorkPlanComposeEntry,
    resolveComposeWorkIntervals,
    composeWorkMinutesForDay,
} from "@/lib/work-plan-compose";
import {
    type PlanPreference,
    buildNetWorkForDay,
    resolveSegmentsForPersonDay,
} from "@/lib/work-plan-preferences";
import type { Staff } from "@/models/types";
import { errorMessage } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { Select } from "../components/ui/input";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { WorkPlanPracticeTimePolicy } from "../components/work-plan-practice-time-policy";
import {
    workTimeGetPracticePolicy,
    workTimeSetPracticePolicy,
} from "@/systems/practice-host/controllers/work-time.controller";
import { listWorkPlanAdjustments } from "@/systems/practice-host/controllers/work-plan-adjustment.controller";
import { useDateFnsLocale, useT, useTParams , useCollatorLocale} from "@/lib/i18n";

const DND_MIME = "application/x-medoc-arbeitsblock";
/** Max visible timeline height (px) — day view; week uses horizontal mini rows. */
const MAX_TIMELINE_PX = 256;

const ALL_DAYS: Array<1 | 2 | 3 | 4 | 5 | 6 | 7> = [1, 2, 3, 4, 5, 6, 7];
const DAY_SHORT_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;

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
    return prefs.filter((p) => (p.staffIds.length === 0 ? true : p.staffIds.includes(pid)));
}

function layoutOverlapBlock(blocks: StaffWorkBlock[]): Map<string, { lane: number; lanes: number }> {
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
    for (const [id, version] of result) {
        result.set(id, { lane: version.lane, lanes: maxL });
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
    staffId: string,
    ymdStr: string,
    prefs: PlanPreference[],
    kind: FilterLayer,
    minD: number,
    daySpan: number,
): HSeg[] {
    const pp = prefsForPerson(prefs, staffId);
    const out: HSeg[] = [];
    if (kind === "net") {
        const { net } = buildNetWorkForDay(staffId, ymdStr, pp);
        net.forEach(([a, b], i) => {
            out.push({ key: `n-${i}`, left: ((a - minD) / daySpan) * 100, w: ((b - a) / daySpan) * 100, bg: "rgba(34, 197, 94, 0.38)" });
        });
        return out;
    }
    const r = resolveSegmentsForPersonDay(staffId, ymdStr, pp);
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

type ComposeCalOpts = { use: boolean; focusId: string; entries: WorkPlanComposeEntry[] };

function horizontalSegmentsForDay(
    staffId: string,
    ymdStr: string,
    planPreferences: PlanPreference[],
    filterLayer: FilterLayer,
    minD: number,
    daySpan: number,
    compose: ComposeCalOpts | null,
): HSeg[] {
    if (compose && personUsesComposeDraft(staffId, compose.use, compose.entries)) {
        if (filterLayer === "break") return [];
        const ivs = resolveComposeWorkIntervals(staffId, ymdStr, compose.entries);
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
    return horizontalPrefSegments(staffId, ymdStr, planPreferences, filterLayer, minD, daySpan);
}

function dayMinutesForPerson(staffId: string, ymdStr: string, prefs: PlanPreference[], kind: FilterLayer): number {
    const pp = prefsForPerson(prefs, staffId);
    const { workRaw, breakRaw, net } = buildNetWorkForDay(staffId, ymdStr, pp);
    const w = workRaw.reduce((s, [a, b]) => s + (b - a), 0);
    const br = breakRaw.reduce((s, [a, b]) => s + (b - a), 0);
    const n = net.reduce((s, [a, b]) => s + (b - a), 0);
    if (kind === "work") return w;
    if (kind === "break") return br;
    if (kind === "net") return n;
    return w + br;
}

function dayMinutesForDisplay(
    staffId: string,
    ymdStr: string,
    prefs: PlanPreference[],
    kind: FilterLayer,
    compose: ComposeCalOpts | null,
): number {
    if (compose && personUsesComposeDraft(staffId, compose.use, compose.entries)) {
        if (kind === "break") return 0;
        const m = composeWorkMinutesForDay(staffId, ymdStr, compose.entries);
        if (kind === "work" || kind === "net") return m;
        if (kind === "both") return m;
    }
    return dayMinutesForPerson(staffId, ymdStr, prefs, kind);
}

/** Display target work intervals (gross) for staff overview */
function formatWorkDayRanges(workRaw: [number, number][]): string {
    if (workRaw.length === 0) return "—";
    return workRaw.map(([a, b]) => `${minToLabel(a)} – ${minToLabel(b)}`).join(" · ");
}

function totalIntervalMinutes(iv: [number, number][]): number {
    return iv.reduce((s, [a, b]) => s + (b - a), 0);
}

function personUsesComposeDraft(
    staffId: string,
    useComposeInCal: boolean,
    entries: WorkPlanComposeEntry[],
): boolean {
    return useComposeInCal && entries.some((e) => e.staffId === staffId);
}

function personHasComposeEntries(staffId: string, entries: WorkPlanComposeEntry[]): boolean {
    return entries.some((e) => e.staffId === staffId);
}

function sollDayBreakdown(
    staffId: string,
    ymdStr: string,
    planPreferences: PlanPreference[],
    composeEntries: WorkPlanComposeEntry[],
) {
    if (personHasComposeEntries(staffId, composeEntries)) {
        const workRaw = resolveComposeWorkIntervals(staffId, ymdStr, composeEntries);
        const workMin = totalIntervalMinutes(workRaw);
        return {
            workRaw,
            breakRaw: [] as [number, number][],
            net: workRaw,
            workMin,
            breakMin: 0,
            netMin: workMin,
        };
    }
    const { workRaw, breakRaw, net } = buildNetWorkForDay(staffId, ymdStr, planPreferences);
    return {
        workRaw,
        breakRaw,
        net,
        workMin: totalIntervalMinutes(workRaw),
        breakMin: totalIntervalMinutes(breakRaw),
        netMin: totalIntervalMinutes(net),
    };
}

/** e.g. 7 h 30 min */
function formatDurationMins(
    mins: number,
    tp: (key: string, params: Record<string, string | number>) => string,
): string {
    if (mins <= 0) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return tp("page.work_plan.duration.hours", { h });
    return tp("page.work_plan.duration.hours_minutes", { h, m });
}

function composeEntryLine(
    e: WorkPlanComposeEntry,
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
    dayShort: string[],
): string {
    if (e.kind === "add_range") {
        const wd =
            e.weekdays.length > 0
                ? tp("page.work_plan.compose.entry.weekdays_prefix", {
                      days: e.weekdays.map((d) => dayShort[d - 1]).join("·"),
                  })
                : t("page.work_plan.compose.entry.weekdays_all");
        return tp("page.work_plan.compose.entry.add_range", {
            from: e.dateFrom,
            to: e.dateTo,
            weekdays: wd,
            start: minToLabel(e.startMin),
            end: minToLabel(e.endMin),
        });
    }
    if (e.kind === "cut_range") {
        return tp("page.work_plan.compose.entry.cut_range", { from: e.dateFrom, to: e.dateTo });
    }
    return tp("page.work_plan.compose.entry.add_day", {
        date: e.date,
        start: minToLabel(e.startMin),
        end: minToLabel(e.endMin),
    });
}

function WorkPlanComposeCard(props: {
    people: Staff[];
    focusId: string;
    onFocusId: (id: string) => void;
    useInCalendar: boolean;
    onUseInCalendar: (version: boolean) => void;
    entries: WorkPlanComposeEntry[];
    canWrite: boolean;
    onAdd: (e: WorkPlanComposeEntry) => void;
    onRemove: (id: string) => void;
}) {
    const {
        people, focusId, onFocusId, useInCalendar, onUseInCalendar, entries, canWrite, onAdd, onRemove,
    } = props;
    const t = useT();
    const tp = useTParams();
    const dayShort = useMemo(() => DAY_SHORT_KEYS.map((k) => t(`page.work_plan.day_short.${k}`)), [t]);
    const [addOpen, setAddOpen] = useState(false);
    const toast = useToastStore((s) => s.add);
    const [df, setDf] = useState(() => format(new Date(), "yyyy-MM-dd"));
    const [dt, setDt] = useState(() => format(addDays(new Date(), 30), "yyyy-MM-dd"));
    const [dDay, setDDay] = useState(() => format(new Date(), "yyyy-MM-dd"));
    const [wds, setWds] = useState<Set<1 | 2 | 3 | 4 | 5 | 6 | 7>>(() => new Set([1, 2, 3, 4, 5]));
    const [tStart, setTStart] = useState("08:00");
    const [tEnd, setTEnd] = useState("17:00");
    const mine = useMemo(() => entries.filter((e) => e.staffId === focusId), [entries, focusId]);

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
            toast(t("page.work_plan.toast.err.select_staff"), "error");
            return;
        }
        const p = parsePair(tStart, tEnd);
        if (!p) {
            toast(t("page.work_plan.toast.err.time_invalid"), "error");
            return;
        }
        onAdd({
            id: newComposeEntryId(),
            kind: "add_range",
            staffId: focusId,
            dateFrom: df,
            dateTo: dt,
            weekdays: wds.size === 0 || wds.size === 7 ? [] : [...wds].sort((a, b) => a - b),
            startMin: p.startMin,
            endMin: p.endMin,
        });
        toast(t("page.work_plan.toast.compose_entry_added"), "success");
        setAddOpen(false);
    };

    const pushCutRange = () => {
        if (!focusId) {
            toast(t("page.work_plan.toast.err.select_staff"), "error");
            return;
        }
        onAdd({
            id: newComposeEntryId(),
            kind: "cut_range",
            staffId: focusId,
            dateFrom: df,
            dateTo: dt,
        });
        toast(t("page.work_plan.toast.compose_cut_added"), "success");
        setAddOpen(false);
    };

    const pushAddDay = () => {
        if (!focusId) {
            toast(t("page.work_plan.toast.err.select_staff"), "error");
            return;
        }
        const p = parsePair(tStart, tEnd);
        if (!p) {
            toast(t("page.work_plan.toast.err.time_invalid"), "error");
            return;
        }
        onAdd({
            id: newComposeEntryId(),
            kind: "add_day",
            staffId: focusId,
            date: dDay,
            startMin: p.startMin,
            endMin: p.endMin,
        });
        toast(t("page.work_plan.toast.compose_day_added"), "success");
        setAddOpen(false);
    };

    return (
        <div className="card workPlan-pref-card">
            <CardHeader
                title={t("page.work_plan.compose.title")}
                subtitle={t("page.work_plan.compose.subtitle")}
            />
            <div className="card-pad" style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                {people.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>{t("page.work_plan.compose.no_staff")}</p>
                ) : (
                    <>
                        <div className="workPlan-settings-row" style={{ flexWrap: "wrap" }}>
                            <Select
                                label={t("page.work_plan.compose.preview_for")}
                                value={focusId}
                                onChange={(e) => onFocusId(e.target.value)}
                                options={people.map((p) => ({ value: p.id, label: p.name }))}
                            />
                            <label className="workPlan-compose-cb" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={useInCalendar}
                                    onChange={(e) => onUseInCalendar(e.target.checked)}
                                />
                                {t("page.work_plan.compose.draft_in_calendar")}
                            </label>
                        </div>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                            {mine.length === 0 ? (
                                <li style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{t("page.work_plan.compose.empty")}</li>
                            ) : (
                                mine.map((e) => (
                                    <li
                                        key={e.id}
                                        className="row"
                                        style={{ justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12.5, lineHeight: 1.35, padding: "6px 8px", borderRadius: 6, background: "var(--surface-1)" }}
                                    >
                                        <span>
                                            <span style={{ color: e.kind === "cut_range" ? "#B45309" : "var(--accent)", fontWeight: 700, marginInlineEnd: 6 }}>{e.kind === "cut_range" ? "−" : "+"}</span>
                                            {composeEntryLine(e, t, tp, dayShort)}
                                        </span>
                                        {canWrite ? (
                                            <button type="button" className="btn btn-ghost" style={{ padding: "2px 8px" }} onClick={() => onRemove(e.id)}>{t("page.work_plan.delete")}</button>
                                        ) : null}
                                    </li>
                                ))
                            )}
                        </ul>
                        {canWrite ? (
                            <div>
                                <Button type="button" size="sm" onClick={() => setAddOpen((o) => !o)}>{t("page.work_plan.add")}</Button>
                                {addOpen ? (
                                    <div style={{ marginTop: 12, padding: 12, border: "1px solid var(--line)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                                        <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>{t("page.work_plan.compose.add_hint")}</p>
                                        <div className="workPlan-time-pair" style={{ gap: 8, flexWrap: "wrap" }}>
                                            <div>
                                                <span className="workPlan-settings-group__l" style={{ display: "block" }}>{t("page.work_plan.label.from")}</span>
                                                <input type="date" className="input-edit" value={df} onChange={(e) => setDf(e.target.value)} />
                                            </div>
                                            <div>
                                                <span className="workPlan-settings-group__l" style={{ display: "block" }}>{t("page.work_plan.label.to")}</span>
                                                <input type="date" className="input-edit" value={dt} onChange={(e) => setDt(e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <span className="workPlan-settings-group__l" style={{ display: "block", marginBottom: 4 }}>{t("page.work_plan.compose.weekdays_label")}</span>
                                            <div className="workPlan-chips" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
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
                                                        >{dayShort[d - 1]}</button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="workDays-range-grid workPlan-time-grid" style={{ maxWidth: 360 }}>
                                            <div className="workDays-range-grid__field">
                                                <span className="workDays-range-grid__l">{t("page.work_plan.label.from")}</span>
                                                <input type="time" step={300} className="workDays-range-grid__in" value={tStart} onChange={(e) => setTStart(e.target.value)} />
                                            </div>
                                            <div className="workDays-range-grid__field workPlan-time-grid_until">
                                                <span className="workDays-range-grid__l">{t("page.work_plan.label.to")}</span>
                                                <input type="time" step={300} className="workDays-range-grid__in" value={tEnd} onChange={(e) => setTEnd(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                            <Button type="button" variant="secondary" onClick={pushAddRange}>{t("page.work_plan.add_range_btn")}</Button>
                                            <Button type="button" variant="secondary" onClick={pushCutRange}>{t("page.work_plan.compose.cut_range_btn")}</Button>
                                        </div>
                                        <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 10, marginTop: 4 }}>
                                            <span className="workPlan-settings-group__l" style={{ display: "block" }}>{t("page.work_plan.compose.single_day")}</span>
                                            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                                                <input type="date" className="input-edit" value={dDay} onChange={(e) => setDDay(e.target.value)} />
                                                <Button type="button" onClick={pushAddDay}>{t("page.work_plan.add_day_btn")}</Button>
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

export function StaffWorkPlanPage() {
    const t = useT();
    const tp = useTParams();
    const sortLocale = useCollatorLocale();
    const dateFnsLocale = useDateFnsLocale();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [store, setStore] = useState<WorkPlanStore>(loadWorkPlanStore);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [view, setView] = useState<WorkPlanView>("week");
    const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
    const [filterLayer, setFilterLayer] = useState<FilterLayer>("both");
    const [filterPersonSet, setFilterPersonSet] = useState<Set<string> | null>(null);
    const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
    const [dragKey, setDragKey] = useState(0);
    const [dndActiveId, setDndActiveId] = useState<string | null>(null);

    const [autoRecordOnLogin, setAutoRecordOnLogin] = useState(false);
    const [autoRecordOnLogout, setAutoRecordOnLogout] = useState(false);
    const [timePolicyBusy, setTimePolicyBusy] = useState(false);

    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.role));
    const canWrite = role != null && allowed("staff.write", role);

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

    const updateStore = useCallback((u: (p: WorkPlanStore) => WorkPlanStore) => {
        setStore((prev) => {
            const n = u(prev);
            saveWorkPlanStore(n);
            return n;
        });
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setStaff(await listStaff());
            let nextStore = loadWorkPlanStore();
            try {
                const adjustments = await listWorkPlanAdjustments({ activeOnly: true });
                const serverEntries: WorkPlanComposeEntry[] = [];
                for (const adj of adjustments) {
                    try {
                        const parsed = JSON.parse(adj.payloadJson) as unknown;
                        serverEntries.push(...parseComposeEntries([parsed]));
                    } catch {
                        /* skip malformed */
                    }
                }
                const ids = new Set(nextStore.composeEntries.map((e) => e.id));
                const merged = serverEntries.filter((e) => !ids.has(e.id));
                if (merged.length > 0) {
                    nextStore = { ...nextStore, composeEntries: [...nextStore.composeEntries, ...merged] };
                    saveWorkPlanStore(nextStore);
                }
            } catch {
                /* adjustments optional offline */
            }
            setStore(nextStore);
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
        if (!canWrite) return;
        void workTimeGetPracticePolicy()
            .then((p) => {
                setAutoRecordOnLogin(p.autoRecordOnLogin);
                setAutoRecordOnLogout(p.autoRecordOnLogout);
            })
            .catch(() => undefined);
    }, [canWrite]);

    const patchPracticeTimePolicy = useCallback(
        (patch: { autoRecordOnLogin?: boolean; autoRecordOnLogout?: boolean }) => {
            setTimePolicyBusy(true);
            void workTimeSetPracticePolicy(patch)
                .then((p) => {
                    setAutoRecordOnLogin(p.autoRecordOnLogin);
                    setAutoRecordOnLogout(p.autoRecordOnLogout);
                    if (patch.autoRecordOnLogin != null) {
                        toast(
                            patch.autoRecordOnLogin
                                ? t("page.work_plan.toast.auto_login_on")
                                : t("page.work_plan.toast.auto_login_off"),
                            "success",
                        );
                    }
                    if (patch.autoRecordOnLogout != null) {
                        toast(
                            patch.autoRecordOnLogout
                                ? t("page.work_plan.toast.auto_logout_on")
                                : t("page.work_plan.toast.auto_logout_off"),
                            "success",
                        );
                    }
                })
                .catch((err) => toast(errorMessage(err), "error"))
                .finally(() => setTimePolicyBusy(false));
        },
        [t, toast],
    );
    useEffect(() => {
        const end = () => setDndActiveId(null);
        window.addEventListener("dragend", end);
        return () => window.removeEventListener("dragend", end);
    }, []);

    const sortedP = useMemo(
        () => [...staff].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
        [staff, sortLocale],
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

    const referenceDays = useMemo(() => {
        if (view === "day") return [dayYmd];
        if (view === "week") return weekDays.map(ymd);
        return monthDays.filter((d) => isSameMonth(d, monthStart)).map(ymd);
    }, [view, dayYmd, weekDays, monthDays, monthStart]);

    const employeeSollRows = useMemo(() => {
        const singleDay = referenceDays.length === 1;
        return sortedP.map((p) => {
            let workMin = 0;
            let breakMin = 0;
            let netMin = 0;
            let dayWorkRaw: [number, number][] = [];
            for (const d of referenceDays) {
                const b = sollDayBreakdown(p.id, d, planPreferences, composeEntries);
                workMin += b.workMin;
                breakMin += b.breakMin;
                netMin += b.netMin;
                if (singleDay) dayWorkRaw = b.workRaw;
            }
            return {
                staff: p,
                sollArbeit: singleDay ? formatWorkDayRanges(dayWorkRaw) : formatDurationMins(workMin, tp),
                pausenMin: breakMin,
                nettoMin: netMin,
            };
        });
    }, [sortedP, referenceDays, planPreferences, composeEntries, tp]);

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

    const handleDropCol = (e: React.DragEvent, ymdStr: string, staffId: string, col: HTMLDivElement) => {
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
            toast(t("page.work_plan.toast.err.grid"), "error");
            return;
        }
        updateStore((s) => ({
            ...s,
            blocks: [...s.blocks.filter((x) => x.id !== id), { ...b, date: ymdStr, staffId, startMin: start, endMin: end }],
        }));
        setDragKey((k) => k + 1);
        toast(t("page.work_plan.toast.block_moved"), "success");
    };

    const handleDropWeekHBar = useCallback((e: React.DragEvent, ymdStr: string, staffId: string, el: HTMLDivElement) => {
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
            toast(t("page.work_plan.toast.err.grid"), "error");
            return;
        }
        updateStore((s) => ({
            ...s,
            blocks: [...s.blocks.filter((x) => x.id !== id), { ...b, date: ymdStr, staffId, startMin: start, endMin: end }],
        }));
        setDragKey((k) => k + 1);
        toast(t("page.work_plan.toast.block_moved"), "success");
    }, [canWrite, store.blocks, minD, daySpan, settings.snapMin, maxD, toast, updateStore, t]);

    const handleCreateWeekEinsatz = useCallback((e: React.MouseEvent, ymdStr: string, staffId: string, el: HTMLDivElement) => {
        if (!canWrite) return;
        const start = xToMin(e, el, minD, daySpan, settings.snapMin);
        const end = Math.min(maxD, start + 4 * 60);
        if (end <= start) return;
        const id = newBlockId();
        const blockTitle = t("page.work_plan.block.default_title");
        updateStore((s) => ({ ...s, blocks: [...s.blocks, { id, staffId, date: ymdStr, startMin: start, endMin: end, title: blockTitle }] }));
        setDragKey((k) => k + 1);
        toast(t("page.work_plan.toast.block_added"), "success");
    }, [canWrite, minD, daySpan, settings.snapMin, maxD, toast, updateStore, t]);

    const periodLabel = useMemo(() => {
        if (view === "day") {
            return tp("page.work_plan.period.day", {
                weekday: format(parseISO(dayYmd), "EEEE", { locale: dateFnsLocale }),
                date: format(parseISO(dayYmd), "d. MMM yyyy", { locale: dateFnsLocale }),
            });
        }
        if (view === "week") {
            return tp("page.work_plan.period.week", {
                week: getISOWeek(weekStart),
                start: format(weekStart, "d. MMM", { locale: dateFnsLocale }),
                end: format(addDays(weekStart, 6), "d. MMM yyyy", { locale: dateFnsLocale }),
            });
        }
        return tp("page.work_plan.period.month", {
            month: format(anchor, "MMMM yyyy", { locale: dateFnsLocale }),
        });
    }, [view, dayYmd, weekStart, anchor, dateFnsLocale, tp]);

    if (loading) return <PageLoading label={t("page.work_plan.loading")} />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load()} />;

    return (
        <div className="staff-workPlan-page practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                titleLevel="h1"
                title={t("page.work_plan.title")}
                subtitle={t("page.work_plan.subtitle")}
                actions={<Link to="/staff" className="btn btn-subtle">{t("page.work_plan.link.team")}</Link>}
            />

            {canWrite ? (
                <WorkPlanPracticeTimePolicy
                    autoRecordOnLogin={autoRecordOnLogin}
                    autoRecordOnLogout={autoRecordOnLogout}
                    busy={timePolicyBusy}
                    onAutoLoginChange={(next) => patchPracticeTimePolicy({ autoRecordOnLogin: next })}
                    onAutoLogoutChange={(next) => patchPracticeTimePolicy({ autoRecordOnLogout: next })}
                />
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                <WorkPlanComposeCard
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
                <div className="card card-pad workPlan-cal-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <h2 className="form-section-title" style={{ marginTop: 0, fontSize: 15 }}>{t("page.work_plan.calendar.all_filtered")}</h2>
                    <p className="workPlan-cal-preface" style={{ fontSize: 12, color: "var(--fg-3)", margin: 0, lineHeight: 1.35 }}>
                        {t("page.work_plan.calendar.preface")}
                    </p>
                    <div className="workPlan-cal-panel">
                    <div className="workPlan-filter-bar workPlan-filter-bar--compact" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div className="workPlan-filter-btns" style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, marginInlineEnd: 2 }}>{t("page.work_plan.display")}</span>
                            {(["work", "break", "both", "net"] as const).map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    className={filterLayer === k ? "btn btn-accent workPlan-view-filter" : "btn btn-ghost workPlan-view-filter"}
                                    onClick={() => setFilterLayer(k)}
                                >
                                    {k === "work" ? t("page.work_plan.filter.work") : k === "break" ? t("page.work_plan.filter.break") : k === "both" ? t("page.work_plan.filter.both") : t("page.work_plan.filter.net")}
                                </button>
                            ))}
                        </div>
                        <div>
                            <span className="kpi-label-mini kpi-label-mini--strong kpi-label-mini--block">
                                {t("page.work_plan.people")}
                            </span>
                            <div className="workPlan-chips workPlan-chips--compact">
                                <button type="button" className={filterPersonSet == null ? "is-active" : undefined} onClick={() => setFilterPersonSet(null)}>{t("page.work_plan.all")}</button>
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
                    <div className="workPlan-toolbar workPlan-toolbar--slim" style={{ marginTop: 0 }}>
                        <div className="workPlan-seg" role="tablist" aria-label={t("page.work_plan.view.aria")}>
                            {(["day", "week", "month"] as const).map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    role="tab"
                                    aria-selected={view === k}
                                    className={view === k ? "is-active" : undefined}
                                    onClick={() => setView(k)}
                                >
                                    {k === "day" ? t("page.work_plan.view.day") : k === "week" ? t("page.work_plan.view.week") : t("page.work_plan.view.month")}
                                </button>
                            ))}
                        </div>
                        <div className="workPlan-nav appointment-nav-controls" dir="ltr">
                            <button type="button" className="btn btn-ghost" onClick={() => {
                                if (view === "day") setAnchor((a) => addDays(a, -1));
                                else if (view === "week") setAnchor((a) => addWeeks(a, -1));
                                else setAnchor((a) => addMonths(a, -1));
                            }}>‹</button>
                            <span className="workPlan-nav__label" style={{ maxWidth: "min(100%, 12rem)", fontSize: 12.5 }}>{periodLabel}</span>
                            <button type="button" className="btn btn-ghost" onClick={() => {
                                if (view === "day") setAnchor((a) => addDays(a, 1));
                                else if (view === "week") setAnchor((a) => addWeeks(a, 1));
                                else setAnchor((a) => addMonths(a, 1));
                            }}>›</button>
                            <button type="button" className="btn btn-subtle" onClick={() => setAnchor(startOfDay(new Date()))}>{t("page.work_plan.today")}</button>
                        </div>
                    </div>

                    {sortedP.length === 0 ? (
                        <p style={{ color: "var(--fg-3)" }}>{t("page.work_plan.empty.no_staff_calendar")} <Link to="/staff">{t("page.work_plan.link.team_list")}</Link></p>
                    ) : null}

                    {view === "month" && sortedP.length > 0 ? (
                        <WorkPlanMonth
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
                        <div className="workPlan-cal-embed" key={`d-${dayYmd}-${dragKey}`}>
                            <div
                                className="workPlan-grid workPlan-grid--day"
                                style={{ gridTemplateColumns: `40px repeat(${activePeople.length}, minmax(0, 1fr))` }}
                            >
                                <div className="workPlan-grid__corner" />
                                {activePeople.map((p) => (
                                    <div key={p.id} className="workPlan-day-head">{p.name}</div>
                                ))}
                                <Ruler minD={minD} daySpan={daySpan} timeColH={timeColH} />
                                {activePeople.map((p) => (
                                    <DayColumn
                                        key={p.id} staff={p} ymdStr={dayYmd} planPreferences={planPreferences} blocks={blocks} filterLayer={filterLayer}
                                        minD={minD} daySpan={daySpan} timeColH={timeColH} canWrite={canWrite} hue={hue} composeCal={composeCal}
                                        onDoubleClickEinsatz={() => {
                                            if (!canWrite) return;
                                            const id = newBlockId();
                                            updateStore((s) => ({
                                                ...s,
                                                blocks: [...s.blocks, { id, staffId: p.id, date: dayYmd, startMin: 8 * 60, endMin: 12 * 60, title: t("page.work_plan.block.default_title") }],
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
                        <div className="workPlan-cal-embed" key={`w-${getISOWeek(weekStart)}-${dragKey}`}>
                            <div className="workPlan-week-matrix-wrap">
                            <div className="workPlan-week-matrix" role="grid" aria-label={t("page.work_plan.week.aria")}>
                                <div className="workPlan-week-matrix__corner" aria-hidden>{t("page.work_plan.week.corner")}</div>
                                {weekDays.map((d) => {
                                    const y = ymd(d);
                                    return (
                                        <div key={y} className="workPlan-week-matrix__dhead">
                                            <span className="workPlan-week-matrix__dow">{format(d, "EEE", { locale: dateFnsLocale })}</span>
                                            <span className="workPlan-week-matrix__dnum">{format(d, "d. MMM", { locale: dateFnsLocale })}</span>
                                        </div>
                                    );
                                })}
                                {activePeople.map((p) => (
                                    <Fragment key={p.id}>
                                        <div className="workPlan-week-matrix__rhead" title={p.name}>
                                            <span className="workPlan-week-matrix__rinit">{personInitials(p.name)}</span>
                                            <span className="workPlan-week-matrix__rname">{p.name}</span>
                                        </div>
                                        {weekDays.map((d) => {
                                            const y = ymd(d);
                                            return (
                                                <WeekPersonDayHBar
                                                    key={`${p.id}-${y}`}
                                                    staff={p}
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
                            </div>
                            <p className="workPlan-week-hint" style={{ fontSize: 10.5, color: "var(--fg-3)", margin: "6px 0 0", lineHeight: 1.3 }}>
                                {tp("page.work_plan.week.hint", { start: minToLabel(minD), end: minToLabel(maxD) })}
                            </p>
                        </div>
                    ) : null}
                    </div>
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="form-section-title" style={{ marginTop: 0 }}>{t("page.work_plan.soll_table.title")}</h2>
                <p className="card-sub" style={{ margin: "4px 0 12px" }}>
                    {tp("page.work_plan.soll_table.period_hint", { period: periodLabel })}
                </p>
                <div className="workPlan-table-wrap">
                    {sortedP.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 13 }}>{t("page.work_plan.empty.no_staff")}</p>
                    ) : (
                        <table className="tbl workPlan-tbl" style={{ width: "100%", fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th>{t("page.work_plan.soll_table.col.staff")}</th>
                                    <th>{t("page.work_plan.soll_table.col.work")}</th>
                                    <th>{t("page.work_plan.soll_table.col.pauses")}</th>
                                    <th>{t("page.work_plan.soll_table.col.net")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employeeSollRows.map((row) => (
                                    <tr key={row.staff.id} className="workPlan-employee-soll__row">
                                        <td>
                                            <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{row.staff.name}</span>
                                        </td>
                                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{row.sollArbeit}</td>
                                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatDurationMins(row.pausenMin, tp)}</td>
                                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatDurationMins(row.nettoMin, tp)}</td>
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
                onConfirm={() => { if (deleteBlockId) updateStore((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== deleteBlockId) })); setDeleteBlockId(null); toast(t("page.work_plan.toast.block_removed"), "success"); }}
                title={t("page.work_plan.confirm.delete_title")} message={t("page.work_plan.confirm.delete_block")} confirmLabel={t("common.delete")} danger
            />
        </div>
    );
}

function WeekPersonDayHBar({
    staff,
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
    staff: Staff;
    ymdStr: string;
    planPreferences: PlanPreference[];
    filterLayer: FilterLayer;
    blocks: StaffWorkBlock[];
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
        () => blocks.filter((b) => b.date === ymdStr && b.staffId === staff.id),
        [blocks, ymdStr, staff.id],
    );
    const lo = useMemo(() => layoutOverlapBlock(myBlocks), [myBlocks]);
    const segs = useMemo(
        () => horizontalSegmentsForDay(staff.id, ymdStr, planPreferences, filterLayer, minD, daySpan, composeCal),
        [staff.id, ymdStr, planPreferences, filterLayer, minD, daySpan, composeCal],
    );

    return (
        <div
            className="workPlan-week-hbar"
            role="gridcell"
            onDragOver={canWrite ? (e) => e.preventDefault() : undefined}
            onDrop={canWrite ? (e) => { e.preventDefault(); onDropCell(e, e.currentTarget as HTMLDivElement); } : undefined}
            onDoubleClick={canWrite ? (e) => onDblClickCell(e, e.currentTarget as HTMLDivElement) : undefined}
        >
            <div className="workPlan-week-hbar__track">
                <div className="workPlan-week-hbar__prefs">
                    {segs.map((s) => (
                        <div
                            key={s.key}
                            className="workPlan-hor-seg"
                            style={{ left: `${s.left}%`, width: `${Math.max(0.35, s.w)}%`, background: s.bg }}
                        />
                    ))}
                </div>
                <div className="workPlan-week-hbar__eins">
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
                                className="workPlan-block-h"
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
                                <span className="workPlan-block-h__lbl">{b.title}</span>
                                {canWrite ? (
                                    <span
                                        className="workPlan-block-h__x"
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
        <div className="workPlan-ruler" style={{ minHeight: timeColH, gridRow: 2, gridColumn: 1 }}>
            {ticks.map((m) => (
                <div key={m} className="workPlan-ruler__tick" style={{ top: ((m - minD) / daySpan) * 100 + "%" }}>
                    {Math.floor(m / 60)}:00
                </div>
            ))}
        </div>
    );
}

function WeekAggregateSegments({ ymdStr, people, prefs, kind, minD, daySpan, composeCal }: {
    ymdStr: string;
    people: Staff[];
    prefs: PlanPreference[];
    kind: FilterLayer;
    minD: number;
    daySpan: number;
    composeCal: ComposeCalOpts | null;
}) {
    const segs: Array<{ top: number; h: number; c: string }> = [];
    for (const person of people) {
        if (composeCal && personUsesComposeDraft(person.id, composeCal.use, composeCal.entries)) {
            if (kind === "break") {
                /* no breaks in plan-build draft */
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
                    className="workPlan-agg"
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

function monthCalEvtClass(staffId: string, people: Staff[]): (typeof MONTH_CAL_EVT)[number] {
    const i = people.findIndex((p) => p.id === staffId);
    return MONTH_CAL_EVT[(i >= 0 ? i : 0) % MONTH_CAL_EVT.length]!;
}

function WorkPlanMonth({ monthDays, monthStart, planPreferences, people, filterLayer, blocks, onSelectDay, composeCal }: {
    monthDays: Date[];
    monthStart: Date;
    planPreferences: PlanPreference[];
    people: Staff[];
    filterLayer: FilterLayer;
    blocks: StaffWorkBlock[];
    onSelectDay: (d: Date) => void;
    composeCal: ComposeCalOpts | null;
}) {
    const t = useT();
    const tp = useTParams();
    const dayShort = useMemo(() => DAY_SHORT_KEYS.map((k) => t(`page.work_plan.day_short.${k}`)), [t]);
    const label =
        filterLayer === "net"
            ? t("page.work_plan.month.filter.net")
            : filterLayer === "work"
              ? t("page.work_plan.month.filter.work")
              : filterLayer === "break"
                ? t("page.work_plan.month.filter.break")
                : t("page.work_plan.month.filter.both");
    const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

    return (
        <div className="cal workPlan-month-cal animate-fade-in" style={{ animationDuration: "240ms" }}>
            {dayShort.map((d) => (
                <div key={d} className="cal-head">
                    {d}
                </div>
            ))}
            {monthDays.map((d) => {
                const y = ymd(d);
                const inM = isSameMonth(d, monthStart);
                const sumMin = people.reduce((s, p) => s + dayMinutesForDisplay(p.id, y, planPreferences, filterLayer, composeCal), 0);
                const dayBlocks = [...blocks]
                    .filter((b) => b.date === y && personById.has(b.staffId))
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
                                    ? tp("page.work_plan.month.tooltip.soll", {
                                          label,
                                          hours: (Math.round((sumMin / 60) * 10) / 10).toString().replace(".", ","),
                                      })
                                    : undefined
                        }
                    >
                        <div className="cal-num">{format(d, "d")}</div>
                        {visible.map((b) => {
                            const p = personById.get(b.staffId);
                            const initials = p ? personInitials(p.name) : "?";
                            const tone = monthCalEvtClass(b.staffId, people);
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
                                {tp("page.work_plan.month.more", { count: more })}
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
                                {tp("page.work_plan.month.soll_hours", {
                                    label,
                                    hours: `${Math.round((sumMin / 60) * 10) / 10}`.replace(".", ","),
                                })}
                            </button>
                        ) : null}
                        {empty ? <div style={{ fontSize: 11, color: "var(--fg-4)", padding: "2px 4px" }}>—</div> : null}
                    </div>
                );
            })}
        </div>
    );
}

function DayColumn({ staff, ymdStr, planPreferences, blocks, filterLayer, minD, daySpan, timeColH, canWrite, hue, composeCal, onDoubleClickEinsatz, onDrop, dndActiveId, setDndActiveId, setDeleteBlockId, onDragStart }: {
    staff: Staff; ymdStr: string; planPreferences: PlanPreference[]; blocks: StaffWorkBlock[]; filterLayer: FilterLayer; minD: number; daySpan: number; timeColH: number;
    canWrite: boolean; hue: (id: string) => number; composeCal: ComposeCalOpts | null;
    onDoubleClickEinsatz: () => void; onDrop: (e: React.DragEvent, el: HTMLDivElement) => void; dndActiveId: string | null; setDndActiveId: (s: string | null) => void; setDeleteBlockId: (s: string | null) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
}) {
    const lo = layoutOverlapBlock(blocks.filter((b) => b.date === ymdStr && b.staffId === staff.id));
    return (
        <div
            className="workPlan-col" onDragOver={canWrite ? (e) => e.preventDefault() : undefined} onDrop={canWrite ? (e) => onDrop(e, e.currentTarget as HTMLDivElement) : undefined}
        >
            <div className="workPlan-col__inner" style={{ minHeight: timeColH, position: "relative" }}>
                {filterLayer === "net" || filterLayer === "both" || filterLayer === "work" || filterLayer === "break" ? (
                    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
                        <WeekAggregateSegments ymdStr={ymdStr} people={[staff]} prefs={planPreferences} kind={filterLayer} minD={minD} daySpan={daySpan} composeCal={composeCal} />
                    </div>
                ) : null}
                <div className="workPlan-col__grid" style={{ minHeight: timeColH }} onDoubleClick={onDoubleClickEinsatz} />
                {blocks.filter((b) => b.date === ymdStr && b.staffId === staff.id).map((b) => (
                    <Block
                        key={b.id} b={b} minD={minD} daySpan={daySpan} lo={lo.get(b.id)} dnd={dndActiveId} canWrite={canWrite} hue={hue(b.staffId)}
                        onDel={() => setDeleteBlockId(b.id)} onDragStart={(e) => onDragStart(e, b.id)} onDragEnd={() => setDndActiveId(null)}
                    />
                ))}
            </div>
        </div>
    );
}

function Block({ b, minD, daySpan, lo, dnd, canWrite, onDel, onDragStart, onDragEnd, hue }: {
    b: StaffWorkBlock; minD: number; daySpan: number; lo?: { lane: number; lanes: number }; dnd: string | null; canWrite: boolean; onDel: () => void;
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
            className="workPlan-block" style={st}
        >
            {minToLabel(b.startMin)} – {minToLabel(b.endMin)} · {b.title}
            {canWrite ? <span className="workPlan-block__del" onClick={(e) => { e.stopPropagation(); onDel(); }}>×</span> : null}
        </button>
    );
}

