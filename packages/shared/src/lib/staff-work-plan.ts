/**
 * Local work plan per staff member (assignments / shifts) — for workflow organization.
 * Persistence: localStorage (same device).
 */
import { addDays, format, getISODay, parseISO, startOfWeek } from "date-fns";
import { de as dateFnsDe } from "date-fns/locale/de";
import type { Locale as DateFnsLocale } from "date-fns";
import type { PlanPreference } from "./work-plan-preferences";
import { defaultLayerForScope } from "./work-plan-preferences";
import type { WorkPlanComposeEntry } from "./work-plan-compose";
import { parseComposeEntries } from "./work-plan-compose";

const LS_KEY_V1 = "medoc-staff-work_plan-v1";
const LS_KEY_V2 = "medoc-staff-work_plan-v2";

export type WorkPlanView = "day" | "week" | "month";

export type StaffWorkBlock = {
    id: string;
    staffId: string;
    /** YYYY-MM-DD */
    date: string;
    /** Minutes from midnight */
    startMin: number;
    endMin: number;
    title: string;
};

/** Visible day grid, snap width, zoom */
export type WorkPlanSettings = {
    /** Visible start (minutes from midnight) */
    dayStartMin: number;
    /** Visible end (exclusive upper bound for blocks: max = dayEndMin) */
    dayEndMin: number;
    snapMin: 5 | 10 | 15 | 30 | 60;
    /** Pixels per minute (zoom) */
    pxPerMin: number;
};

export type WorkTimePreset = {
    id: string;
    name: string;
    startMin: number;
    endMin: number;
};

/** Target hours: Mon–Sun (weekday 1=Mon … 7=Sun, ISO) */
export type WeeklyWorkRule = {
    id: string;
    staffId: string;
    weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    startMin: number;
    endMin: number;
};

export type WorkPlanStore = {
    blocks: StaffWorkBlock[];
    settings: WorkPlanSettings;
    presets: WorkTimePreset[];
    weeklyRules: WeeklyWorkRule[];
    /** Named plans (work/break, validity, cascade) — see `work_plan-preferences.ts` */
    planPreferences: PlanPreference[];
    /** Additive draft entries (add / time off) — see `work_plan-compose.ts` */
    composeEntries: WorkPlanComposeEntry[];
};

type StoreV1 = { blocks: StaffWorkBlock[] };

export function defaultSettings(): WorkPlanSettings {
    return { dayStartMin: 6 * 60, dayEndMin: 20 * 60, snapMin: 15, pxPerMin: 1.25 };
}

export function defaultPresets(): WorkTimePreset[] {
    return [
        { id: "p-vm", name: "Vormittag", startMin: 8 * 60, endMin: 12 * 60 },
        { id: "p-nm", name: "Nachmittag", startMin: 12 * 60, endMin: 17 * 60 },
        { id: "p-day", name: "Office 8–17", startMin: 8 * 60, endMin: 17 * 60 },
    ];
}

function isBlock(b: unknown): b is StaffWorkBlock {
    return (
        b != null
        && typeof b === "object"
        && typeof (b as StaffWorkBlock).id === "string"
        && typeof (b as StaffWorkBlock).staffId === "string"
        && typeof (b as StaffWorkBlock).date === "string"
        && typeof (b as StaffWorkBlock).startMin === "number"
        && typeof (b as StaffWorkBlock).endMin === "number"
        && typeof (b as StaffWorkBlock).title === "string"
        && (b as StaffWorkBlock).endMin > (b as StaffWorkBlock).startMin
    );
}

function parseStoreV1(raw: string): WorkPlanStore {
    const j = JSON.parse(raw) as StoreV1;
    return {
        blocks: Array.isArray(j.blocks) ? j.blocks.filter(isBlock) : [],
        settings: defaultSettings(),
        presets: defaultPresets(),
        weeklyRules: [],
        planPreferences: [],
        composeEntries: [],
    };
}

function isPlanPreference(p: unknown): p is PlanPreference {
    if (p == null || typeof p !== "object") return false;
    const o = p as PlanPreference;
    return (
        typeof o.id === "string"
        && typeof o.name === "string"
        && Array.isArray(o.staffIds)
        && (o.kind === "work" || o.kind === "break")
        && typeof o.layer === "number"
        && (o.parentId === null || typeof o.parentId === "string")
        && typeof o.startMin === "number"
        && typeof o.endMin === "number"
        && o.endMin > o.startMin
        && ["general", "day", "week", "month", "period"].includes(o.scopeType)
        && (!("weekdays" in o) || Array.isArray((o as { weekdays?: unknown }).weekdays))
    );
}

function migrateWeeklyToPlan(s: WorkPlanStore): WorkPlanStore {
    if (s.planPreferences.length > 0 || s.weeklyRules.length === 0) {
        return s;
    }
    const planPreferences: PlanPreference[] = s.weeklyRules.map((r) => ({
        id: r.id,
        name: "Target (imported from week rules)",
        staffIds: [r.staffId],
        kind: "work" as const,
        layer: defaultLayerForScope("general"),
        parentId: null,
        startMin: r.startMin,
        endMin: r.endMin,
        scopeType: "general" as const,
        weekdays: [r.weekday],
    }));
    return { ...s, planPreferences, weeklyRules: [] };
}

function parseStoreV2(raw: string): WorkPlanStore | null {
    try {
        const j = JSON.parse(raw) as {
            blocks?: unknown;
            settings?: WorkPlanSettings;
            presets?: WorkTimePreset[];
            weeklyRules?: WeeklyWorkRule[];
            planPreferences?: unknown;
        };
        const blocks = Array.isArray(j.blocks) ? j.blocks.filter(isBlock) : [];
        const s = j.settings;
        const settings: WorkPlanSettings = s
            && typeof s.dayStartMin === "number"
            && typeof s.dayEndMin === "number"
            && s.dayEndMin > s.dayStartMin
            && s.dayStartMin >= 0
            && s.dayEndMin <= 24 * 60
            ? {
                dayStartMin: s.dayStartMin,
                dayEndMin: s.dayEndMin,
                snapMin: [5, 10, 15, 30, 60].includes(s.snapMin) ? s.snapMin : 15,
                pxPerMin: typeof s.pxPerMin === "number" && s.pxPerMin >= 0.5 && s.pxPerMin <= 3 ? s.pxPerMin : 1.25,
            }
            : defaultSettings();
        const presets = Array.isArray(j.presets)
            ? j.presets.filter(
                (p): p is WorkTimePreset =>
                    p != null
                    && typeof (p as WorkTimePreset).id === "string"
                    && typeof (p as WorkTimePreset).name === "string"
                    && typeof (p as WorkTimePreset).startMin === "number"
                    && typeof (p as WorkTimePreset).endMin === "number"
                    && (p as WorkTimePreset).endMin > (p as WorkTimePreset).startMin,
            )
            : defaultPresets();
        const weeklyRules = Array.isArray(j.weeklyRules)
            ? j.weeklyRules.filter(
                (r): r is WeeklyWorkRule =>
                    r != null
                    && typeof (r as WeeklyWorkRule).id === "string"
                    && typeof (r as WeeklyWorkRule).staffId === "string"
                    && typeof (r as WeeklyWorkRule).weekday === "number"
                    && (r as WeeklyWorkRule).weekday >= 1
                    && (r as WeeklyWorkRule).weekday <= 7
                    && typeof (r as WeeklyWorkRule).startMin === "number"
                    && typeof (r as WeeklyWorkRule).endMin === "number"
                    && (r as WeeklyWorkRule).endMin > (r as WeeklyWorkRule).startMin,
            )
            : [];
        const planPreferences = Array.isArray(j.planPreferences)
            ? (j.planPreferences as unknown[])
                .map((p) => {
                    if (p == null || typeof p !== "object") return p;
                    const o = p as Record<string, unknown>;
                    if (!Array.isArray(o.weekdays)) o.weekdays = [];
                    return o;
                })
                .filter(isPlanPreference)
            : [];
        const composeEntries = parseComposeEntries((j as { composeEntries?: unknown }).composeEntries);
        return { blocks, settings, presets, weeklyRules, planPreferences, composeEntries };
    } catch {
        return null;
    }
}

export function loadWorkPlanStore(): WorkPlanStore {
    if (globalThis.localStorage == null) {
        return {
            blocks: [],
            settings: defaultSettings(),
            presets: defaultPresets(),
            weeklyRules: [],
            planPreferences: [],
            composeEntries: [],
        };
    }
    try {
        const v2 = localStorage.getItem(LS_KEY_V2);
        if (v2) {
            const p = parseStoreV2(v2);
            if (p) {
                const migratedWeekly = migrateWeeklyToPlan(p);
                const weeklyDirty =
                    migratedWeekly.planPreferences.length !== p.planPreferences.length
                    || migratedWeekly.weeklyRules.length !== p.weeklyRules.length;
                if (weeklyDirty) {
                    saveWorkPlanStore(migratedWeekly);
                }
                return migratedWeekly;
            }
        }
        const v1 = localStorage.getItem(LS_KEY_V1);
        if (v1) {
            const migrated = parseStoreV1(v1);
            saveWorkPlanStore(migrated);
            return migrated;
        }
    } catch {
        /* fallthrough */
    }
    return {
        blocks: [],
        settings: defaultSettings(),
        presets: defaultPresets(),
        weeklyRules: [],
        planPreferences: [],
        composeEntries: [],
    };
}

export function saveWorkPlanStore(s: WorkPlanStore): void {
    if (globalThis.localStorage == null) return;
    localStorage.setItem(LS_KEY_V2, JSON.stringify(s));
}

export function loadWorkPlanBlocks(): StaffWorkBlock[] {
    return loadWorkPlanStore().blocks;
}

export function saveWorkPlanBlocks(blocks: StaffWorkBlock[]): void {
    const s = loadWorkPlanStore();
    s.blocks = blocks;
    saveWorkPlanStore(s);
}

export function deleteBlock(id: string): void {
    const s = loadWorkPlanStore();
    s.blocks = s.blocks.filter((b) => b.id !== id);
    saveWorkPlanStore(s);
}

export function newBlockId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `apb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newPresetId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `appr-${Date.now()}`;
}

export function newRuleId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `apwr-${Date.now()}`;
}

/** Minutes since midnight from hours 0–23, min 0–59 */
export function timeToMin(h: number, m: number): number {
    return h * 60 + m;
}

export function minToLabel(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatLocalizedDate(ymd: string, locale: DateFnsLocale): string {
    try {
        return format(parseISO(ymd), "EEEE, d. MMM yyyy", { locale });
    } catch {
        return ymd;
    }
}

/** @deprecated Use formatLocalizedDate with dateFnsLocaleFor()/useDateFnsLocale(). */
export function formatDeDate(ymd: string): string {
    return formatLocalizedDate(ymd, dateFnsDe);
}

/** Wochenstart Montag */
export function weekStartMonday(d: Date): Date {
    return startOfWeek(d, { weekStartsOn: 1 });
}

export function weekDaysMonFirst(weekStart: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function ymd(d: Date): string {
    return format(d, "yyyy-MM-dd");
}

export function parseYmd(s: string): Date {
    return parseISO(s.length >= 10 ? s.slice(0, 10) : s);
}

/** ISO: Mo=1 … So=7 (date-fns getISODay) */
export function isoWeekdayFromYmd(dateStr: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
    return getISODay(parseYmd(dateStr)) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function rulesForDay(
    staffId: string,
    ymdStr: string,
    rules: WeeklyWorkRule[],
): WeeklyWorkRule[] {
    const wd = isoWeekdayFromYmd(ymdStr);
    return rules.filter((r) => r.staffId === staffId && r.weekday === wd);
}

/** Simple color per staffId (UI) — FNV-1a-like spread over HSL hue. */
export function hueForStaff(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % 360;
}
