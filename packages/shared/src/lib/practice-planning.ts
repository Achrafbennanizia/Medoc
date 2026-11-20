import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";
import { minutesToTime } from "@/lib/utils";
import { PRACTICE_WORK_HOURS_CHANGED_EVENT } from "./appointment-calendar-layout";

/**
 * Browser-side cache key. The authoritative store is the backend `app_kv`
 * table under the same key (see `practice.work_hours.v1` in
 * {@link app-kv.controller.ts}); localStorage is only a synchronous fast-path
 * so existing components can keep their sync `read…` helpers.
 */
export const PRACTICE_WORK_HOURS_LS_KEY = "medoc-practice-work_hours-v1";
const PRACTICE_KV_KEY = "practice.work_hours.v1" as const;

export const PRACTICE_DAY_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;
export type PracticeDayKey = (typeof PRACTICE_DAY_KEYS)[number];

export type PracticeDayPlan = {
    active: boolean;
    /** Multiple working windows per day (e.g. 08:00-12:00 + 14:00-18:00). */
    segments: Array<{ from: string; to: string }>;
};

export type PracticeClosureMode = "FULL_DAY" | "CUSTOM";

export type PracticeClosureRule = {
    id: string;
    date: string; // yyyy-MM-dd
    mode: PracticeClosureMode;
    /** For CUSTOM mode: one or more blocked periods within the day. */
    periods?: Array<{ from: string; to: string }>;
    reason?: string;
};

/** Week plan + break + slot only — special closures remain practice-wide. */
export type PhysicianWorkTimeProfil = {
    plan: Record<PracticeDayKey, PracticeDayPlan>;
    breakFrom: string;
    breakUntil: string;
    slotMin: string;
};

export type PracticeWorkHoursConfig = {
    plan: Record<PracticeDayKey, PracticeDayPlan>;
    breakFrom: string;
    breakUntil: string;
    slotMin: string;
    closures: PracticeClosureRule[];
    /** Default Clinician for "Neuer Appointment" when URL does not override. */
    defaultPhysicianId?: string;
    /** Own office hours per physician; missing entry = practice default ({@link plan}, break, slot). */
    physicianSchedules?: Record<string, PhysicianWorkTimeProfil>;
};

const DEFAULT_PLAN: Record<PracticeDayKey, PracticeDayPlan> = {
    mo: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
    di: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
    mi: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
    do: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
    fr: { active: true, segments: [{ from: "08:00", to: "15:00" }] },
    sa: { active: false, segments: [{ from: "09:00", to: "13:00" }] },
    so: { active: false, segments: [{ from: "09:00", to: "13:00" }] },
};

const DEFAULT_CFG: PracticeWorkHoursConfig = {
    plan: DEFAULT_PLAN,
    breakFrom: "12:30",
    breakUntil: "13:30",
    slotMin: "30",
    closures: [],
    defaultPhysicianId: undefined,
    physicianSchedules: undefined,
};

const JS_WEEKDAY_TO_PRACTICE_DAY: readonly PracticeDayKey[] = ["so", "mo", "di", "mi", "do", "fr", "sa"];

/** `HH:MM` from a time input (`08:00` or `08:00:00`). */
export function practiceHm(value: string): string {
    const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
    if (!match) return value.trim();
    return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

function openSegments(day: PracticeDayPlan | undefined): Array<{ from: string; to: string }> {
    if (!day?.active) return [];
    return (day.segments ?? [])
        .map((segment) => ({ from: practiceHm(segment.from), to: practiceHm(segment.to) }))
        .filter((segment) => segment.from && segment.to && segment.from < segment.to);
}

export function practiceDayKeyForDate(date: Date): PracticeDayKey {
    return JS_WEEKDAY_TO_PRACTICE_DAY[date.getDay()] ?? "mo";
}

/** Last closing time for that local day, or null when the practice is closed. */
export function practiceClosingTimeHm(cfg: PracticeWorkHoursConfig, date: Date): string | null {
    const segments = openSegments(cfg.plan[practiceDayKeyForDate(date)]);
    if (segments.length === 0) return null;
    return segments.reduce((latest, segment) => (segment.to > latest ? segment.to : latest), segments[0]!.to);
}

export function practiceSlotMinutes(cfg: PracticeWorkHoursConfig): number {
    const minutes = Number.parseInt(cfg.slotMin, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return 30;
    return Math.min(480, Math.max(5, minutes));
}

/**
 * Opening-hours line in the active language.
 * Default plan: `Mon–Thu 08:00–17:00, Fri 08:00–15:00`.
 * Wrapped in an LTR isolate so the from–to order stays the same in Arabic.
 */
export function formatPracticeOpeningHours(
    cfg: PracticeWorkHoursConfig,
    dayLabel: (key: PracticeDayKey) => string,
): string {
    const groups: Array<{ start: PracticeDayKey; end: PracticeDayKey; hours: string }> = [];
    for (const key of PRACTICE_DAY_KEYS) {
        const segments = openSegments(cfg.plan[key]);
        if (segments.length === 0) continue;
        const hours = segments.map((segment) => `${segment.from}–${segment.to}`).join(" · ");
        const previous = groups[groups.length - 1];
        const previousIndex = previous ? PRACTICE_DAY_KEYS.indexOf(previous.end) : -2;
        if (previous && previous.hours === hours && PRACTICE_DAY_KEYS.indexOf(key) === previousIndex + 1) {
            previous.end = key;
        } else {
            groups.push({ start: key, end: key, hours });
        }
    }
    if (groups.length === 0) return "";
    const body = groups
        .map((group) => {
            const days = group.start === group.end ? dayLabel(group.start) : `${dayLabel(group.start)}–${dayLabel(group.end)}`;
            return `${days} ${group.hours}`;
        })
        .join(", ");
    return `\u2066${body}\u2069`;
}

type PlanParseInput = Record<
    string,
    { active?: boolean; from?: string; until?: string; segments?: Array<{ from: string; to: string }> }
> | undefined;

function mergePlanFromParsed(planRaw: PlanParseInput): Record<PracticeDayKey, PracticeDayPlan> {
    const mergedPlan = { ...DEFAULT_PLAN } as Record<PracticeDayKey, PracticeDayPlan>;
    if (!planRaw) return mergedPlan;
    for (const key of PRACTICE_DAY_KEYS) {
        const p = planRaw[key];
        if (!p) continue;
        const legacySeg = p.from && p.until ? [{ from: p.from, to: p.until }] : undefined;
        mergedPlan[key] = {
            active: p.active ?? mergedPlan[key].active,
            segments: (p.segments && p.segments.length ? p.segments : legacySeg ?? mergedPlan[key].segments)
                .filter((s) => s.from && s.to && s.from < s.to),
        };
    }
    return mergedPlan;
}

function parsePhysicianSchedules(raw: unknown): Record<string, PhysicianWorkTimeProfil> | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const out: Record<string, PhysicianWorkTimeProfil> = {};
    for (const [id, version] of Object.entries(raw as Record<string, unknown>)) {
        const aid = id.trim();
        if (!aid || !version || typeof version !== "object") continue;
        const vo = version as {
            plan?: PlanParseInput;
            breakFrom?: string;
            breakUntil?: string;
            slotMin?: string;
        };
        out[aid] = {
            plan: mergePlanFromParsed(vo.plan),
            breakFrom: typeof vo.breakFrom === "string" ? vo.breakFrom : DEFAULT_CFG.breakFrom,
            breakUntil: typeof vo.breakUntil === "string" ? vo.breakUntil : DEFAULT_CFG.breakUntil,
            slotMin: typeof vo.slotMin === "string" ? vo.slotMin : DEFAULT_CFG.slotMin,
        };
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

function parseConfigBlob(raw: string | null | undefined): PracticeWorkHoursConfig {
    try {
        if (!raw) return DEFAULT_CFG;
        const parsed = JSON.parse(raw) as {
            plan?: PlanParseInput;
            breakFrom?: string;
            breakUntil?: string;
            slotMin?: string;
            defaultPhysicianId?: string;
            physicianSchedules?: Record<string, unknown>;
            closures?: Array<{
                id: string;
                date: string;
                mode?: string;
                periods?: Array<{ from: string; to: string }>;
                from?: string;
                to?: string;
                reason?: string;
            }>;
        };
        const mergedPlan = mergePlanFromParsed(parsed.plan);
        const closures = (parsed.closures ?? []).map((c) => {
            if (c.mode === "FULL_DAY") return { ...c, mode: "FULL_DAY" as const, periods: [] };
            if (c.mode === "CUSTOM") {
                const periods =
                    c.periods && c.periods.length
                        ? c.periods
                        : (c.from && c.to ? [{ from: c.from, to: c.to }] : []);
                return { ...c, mode: "CUSTOM" as const, periods: periods.filter((p) => p.from && p.to && p.from < p.to) };
            }
            // legacy MORNING / EVENING fallback
            if (c.mode === "MORNING") return { ...c, mode: "CUSTOM" as const, periods: [{ from: "00:00", to: "12:00" }] };
            if (c.mode === "EVENING") return { ...c, mode: "CUSTOM" as const, periods: [{ from: "12:00", to: "23:59" }] };
            return { ...c, mode: "FULL_DAY" as const, periods: [] };
        });
        const defaultPhysicianId =
            typeof parsed.defaultPhysicianId === "string" && parsed.defaultPhysicianId.trim()
                ? parsed.defaultPhysicianId.trim()
                : undefined;
        const physicianSchedules = parsePhysicianSchedules(parsed.physicianSchedules);
        return {
            plan: mergedPlan,
            breakFrom: parsed.breakFrom ?? DEFAULT_CFG.breakFrom,
            breakUntil: parsed.breakUntil ?? DEFAULT_CFG.breakUntil,
            slotMin: parsed.slotMin ?? DEFAULT_CFG.slotMin,
            closures,
            defaultPhysicianId,
            physicianSchedules,
        };
    } catch {
        if (raw && raw.trim()) {
            throw new Error("Stored work hours are invalid");
        }
        return DEFAULT_CFG;
    }
}

/**
 * Synchronous reader backed by `localStorage` (fast UX). Refreshed by
 * {@link loadPracticeWorkHoursConfig} when the page mounts so the cache
 * stays in sync with the SQLite source of truth.
 */
export function readPracticeWorkHoursConfig(): PracticeWorkHoursConfig {
    return { ...DEFAULT_CFG, plan: { ...DEFAULT_CFG.plan } };
}

/**
 * Authoritative read from the backend `app_kv` row; falls back to the
 * localStorage cache (and finally the defaults) when the backend is
 * unreachable. Updates the localStorage cache so subsequent synchronous
 * reads return the freshest config.
 */
export async function loadPracticeWorkHoursConfig(): Promise<PracticeWorkHoursConfig> {
    try {
        const raw = await getAppKv(PRACTICE_KV_KEY);
        if (raw) {
            return parseConfigBlob(raw);
        }
        const storage = globalThis.localStorage;
        if (storage) {
            const ls = storage.getItem(PRACTICE_WORK_HOURS_LS_KEY);
            if (ls) {
                await setAppKv(PRACTICE_KV_KEY, ls);
                storage.removeItem(PRACTICE_WORK_HOURS_LS_KEY);
                return parseConfigBlob(ls);
            }
        }
    } catch (e) {
        if (e instanceof Error && e.message === "Stored work hours are invalid") {
            throw e;
        }
    }
    return readPracticeWorkHoursConfig();
}

/**
 * Persist the config in SQLite (authoritative) and refresh the localStorage
 * cache so existing synchronous readers see the change immediately.
 */
export async function savePracticeWorkHoursConfig(cfg: PracticeWorkHoursConfig): Promise<void> {
    const blob = JSON.stringify(cfg);
    await setAppKv(PRACTICE_KV_KEY, blob);
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PRACTICE_WORK_HOURS_CHANGED_EVENT, { detail: cfg }));
    }
}

/**
 * Effective configuration for a practitioner: own profile or practice default.
 * `closures` always remain practice-wide.
 */
export function resolveEffectiveWorkHoursForPhysician(
    cfg: PracticeWorkHoursConfig,
    physicianId: string | null | undefined,
): PracticeWorkHoursConfig {
    const id = typeof physicianId === "string" ? physicianId.trim() : "";
    if (!id) return cfg;
    const prof = cfg.physicianSchedules?.[id];
    if (!prof) return cfg;
    return {
        ...cfg,
        plan: prof.plan,
        breakFrom: prof.breakFrom,
        breakUntil: prof.breakUntil,
        slotMin: prof.slotMin,
    };
}

/** Merge overlapping/adjacent HH:mm segments into a sorted open list. */
export function unionWorkSegments(
    a: Array<{ from: string; to: string }> | undefined,
    b: Array<{ from: string; to: string }> | undefined,
): Array<{ from: string; to: string }> {
    const raw = [...(a ?? []), ...(b ?? [])]
        .map((s) => ({ from: practiceHm(s.from), to: practiceHm(s.to) }))
        .filter((s) => s.from && s.to && s.from < s.to)
        .sort((x, y) => x.from.localeCompare(y.from) || x.to.localeCompare(y.to));
    if (raw.length === 0) return [];
    const out: Array<{ from: string; to: string }> = [{ ...raw[0]! }];
    for (let i = 1; i < raw.length; i++) {
        const next = raw[i]!;
        const last = out[out.length - 1]!;
        if (next.from <= last.to) {
            if (next.to > last.to) last.to = next.to;
        } else {
            out.push({ ...next });
        }
    }
    return out;
}

/**
 * Appointment booking: practice administration hours are the baseline for every open day.
 * A doctor profile cannot hide practice-open days or times (e.g. Saturday enabled in
 * Administration → Opening hours, or a later Thursday close). When both are active for a
 * weekday, open segments are the union — practice extensions stay bookable even if a
 * stale doctor profile still has shorter hours. A doctor-only active day can still add
 * hours beyond the practice default.
 *
 * Pass `isoDate` when checking a concrete day so break/slot come from the same source as
 * that day's segments (doctor break only on days the doctor profile marks active; otherwise
 * practice break). Without a date, doctor break/slot apply whenever a profile exists
 * (week-level defaults such as slot step on New appointment).
 */
export function resolveBookingWorkHoursForPhysician(
    cfg: PracticeWorkHoursConfig,
    physicianId: string | null | undefined,
    isoDate?: string | null,
): PracticeWorkHoursConfig {
    const id = typeof physicianId === "string" ? physicianId.trim() : "";
    if (!id) return cfg;
    const prof = cfg.physicianSchedules?.[id];
    if (!prof) return cfg;

    const mergedPlan = { ...cfg.plan } as Record<PracticeDayKey, PracticeDayPlan>;
    for (const key of PRACTICE_DAY_KEYS) {
        const practiceDay = cfg.plan[key];
        const doctorDay = prof.plan[key];
        if (practiceDay?.active && doctorDay?.active) {
            mergedPlan[key] = {
                active: true,
                segments: unionWorkSegments(practiceDay.segments, doctorDay.segments),
            };
        } else if (practiceDay?.active) {
            mergedPlan[key] = practiceDay;
        } else if (doctorDay?.active) {
            mergedPlan[key] = doctorDay;
        } else {
            mergedPlan[key] = doctorDay ?? practiceDay ?? mergedPlan[key];
        }
    }

    const dayKey = isoDate?.trim() ? dayKeyFromIsoDate(isoDate) : null;
    const useDoctorBreakAndSlot = dayKey ? Boolean(prof.plan[dayKey]?.active) : true;

    return {
        ...cfg,
        plan: mergedPlan,
        breakFrom: useDoctorBreakAndSlot ? prof.breakFrom : cfg.breakFrom,
        breakUntil: useDoctorBreakAndSlot ? prof.breakUntil : cfg.breakUntil,
        slotMin: useDoctorBreakAndSlot ? prof.slotMin : cfg.slotMin,
    };
}

export function hmToMinutes(hm: string): number {
    const [h, m] = hm.split(":").map((n) => Number(n));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function dayKeyFromIsoDate(iso: string): PracticeDayKey {
    const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!p) return "mo";
    const y = Number(p[1]);
    const mo = Number(p[2]) - 1;
    const da = Number(p[3]);
    const js = new Date(y, mo, da).getDay();
    const map: PracticeDayKey[] = ["so", "mo", "di", "mi", "do", "fr", "sa"];
    return map[js] ?? "mo";
}

function inRange(hm: string, from: string, to: string): boolean {
    const version = hmToMinutes(hm);
    return version >= hmToMinutes(from) && version < hmToMinutes(to);
}

export function isSlotBlockedByPracticeConfig(cfg: PracticeWorkHoursConfig, isoDate: string, hm: string): boolean {
    const day = cfg.plan[dayKeyFromIsoDate(isoDate)];
    if (!day?.active) return true;
    const inAnyWorkSegment = (day.segments ?? []).some((s) => inRange(hm, s.from, s.to));
    if (!inAnyWorkSegment) return true;
    if (cfg.breakFrom && cfg.breakUntil && inRange(hm, cfg.breakFrom, cfg.breakUntil)) return true;

    const rules = cfg.closures.filter((r) => r.date === isoDate);
    for (const r of rules) {
        if (r.mode === "FULL_DAY") return true;
        if (r.mode === "CUSTOM" && (r.periods ?? []).some((p) => inRange(hm, p.from, p.to))) return true;
    }
    return false;
}

/** True if any minute in [startMin, endMin) is outside Sprechzeit, inside Pause, or in Special-BlockedTimes. */
export function isAppointmentSpanBlockedByPracticeConfig(
    cfg: PracticeWorkHoursConfig,
    isoDate: string,
    startMin: number,
    endMin: number,
): boolean {
    if (endMin <= startMin) return true;
    for (let m = startMin; m < endMin; m += 1) {
        const hm = minutesToTime(m);
        if (isSlotBlockedByPracticeConfig(cfg, isoDate, hm)) return true;
    }
    return false;
}

export function hasAnyAvailableSlot(cfg: PracticeWorkHoursConfig, isoDate: string): boolean {
    const dayKey = dayKeyFromIsoDate(isoDate);
    const day = cfg.plan[dayKey];
    if (!day?.active) return false;
    for (const r of cfg.closures) {
        if (r.date === isoDate && r.mode === "FULL_DAY") return false;
    }
    const step = Math.max(5, Number(cfg.slotMin) || 30);
    for (const seg of day.segments ?? []) {
        if (!seg.from || !seg.to || seg.from >= seg.to) continue;
        const segStart = hmToMinutes(seg.from);
        const segEnd = hmToMinutes(seg.to);
        for (let m = segStart; m < segEnd; m += step) {
            const hm = minutesToTime(m);
            if (!isSlotBlockedByPracticeConfig(cfg, isoDate, hm)) return true;
        }
    }
    return false;
}

/** Day is open per administration plan (active flag + hours segment, no full-day closure). */
export function isPracticeDayOpen(cfg: PracticeWorkHoursConfig, isoDate: string): boolean {
    const dayKey = dayKeyFromIsoDate(isoDate);
    const day = cfg.plan[dayKey];
    if (!day?.active) return false;
    if (cfg.closures.some((c) => c.date === isoDate && c.mode === "FULL_DAY")) return false;
    return (day.segments ?? []).some((s) => s.from && s.to && s.from < s.to);
}

/**
 * Calendar day pickers: practice administration hours always apply; a doctor-specific
 * profile can additionally enable days beyond the practice default.
 */
export function isCalendarDaySelectable(
    practiceCfg: PracticeWorkHoursConfig,
    isoDate: string,
    physicianId?: string | null,
): boolean {
    if (isPracticeDayOpen(practiceCfg, isoDate)) return true;
    const id = typeof physicianId === "string" ? physicianId.trim() : "";
    if (!id) return false;
    const eff = resolveEffectiveWorkHoursForPhysician(practiceCfg, id);
    if (eff === practiceCfg) return false;
    return isPracticeDayOpen(eff, isoDate);
}

/** Practice-wide: can any appointment be booked on this calendar day? */
export function isPracticeDayBookable(cfg: PracticeWorkHoursConfig, isoDate: string): boolean {
    return hasAnyAvailableSlot(cfg, isoDate);
}
