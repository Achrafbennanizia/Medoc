/**
 * Lokaler Arbeitsplan pro Mitarbeiter (Einsätze / Schichten) — zur Workflow-Organisation.
 * Persistenz: localStorage (gleiches Gerät).
 */
import { addDays, format, getISODay, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import type { PlanPreference } from "./arbeitsplan-preferences";
import { defaultLayerForScope } from "./arbeitsplan-preferences";
import type { ArbeitsplanComposeEntry } from "./arbeitsplan-compose";
import { parseComposeEntries } from "./arbeitsplan-compose";

const LS_KEY_V1 = "medoc-personal-arbeitsplan-v1";
const LS_KEY_V2 = "medoc-personal-arbeitsplan-v2";

export type ArbeitsplanView = "day" | "week" | "month";

export type PersonalArbeitsBlock = {
    id: string;
    personalId: string;
    /** YYYY-MM-DD */
    date: string;
    /** Minuten ab Mitternacht */
    startMin: number;
    endMin: number;
    title: string;
};

/** Sichtbares Tagesraster, Rasterweite, Zoom */
export type ArbeitsplanSettings = {
    /** Sichtbarer Beginn (Minuten ab Mitternacht) */
    dayStartMin: number;
    /** Sichtbares Ende (exkl. obere Grenze für Blöcke: max = dayEndMin) */
    dayEndMin: number;
    snapMin: 5 | 10 | 15 | 30 | 60;
    /** Pixel pro Minute (Zoom) */
    pxPerMin: number;
};

export type ArbeitszeitPreset = {
    id: string;
    name: string;
    startMin: number;
    endMin: number;
};

/** Soll: Mo–So (weekday 1=Mo … 7=So, ISO) */
export type WochenarbeitsRegel = {
    id: string;
    personalId: string;
    weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    startMin: number;
    endMin: number;
};

export type ArbeitsplanStore = {
    blocks: PersonalArbeitsBlock[];
    settings: ArbeitsplanSettings;
    presets: ArbeitszeitPreset[];
    weeklyRules: WochenarbeitsRegel[];
    /** Benannte Pläne (Arbeit/Pause, Gültigkeit, Kaskade) — siehe `arbeitsplan-preferences.ts` */
    planPreferences: PlanPreference[];
    /** Additive Entwurfs-Einträge (Hinzufügen / Freistellen) — siehe `arbeitsplan-compose.ts` */
    composeEntries: ArbeitsplanComposeEntry[];
};

type StoreV1 = { blocks: PersonalArbeitsBlock[] };

export function defaultSettings(): ArbeitsplanSettings {
    return { dayStartMin: 6 * 60, dayEndMin: 20 * 60, snapMin: 15, pxPerMin: 1.25 };
}

export function defaultPresets(): ArbeitszeitPreset[] {
    return [
        { id: "p-vm", name: "Vormittag", startMin: 8 * 60, endMin: 12 * 60 },
        { id: "p-nm", name: "Nachmittag", startMin: 12 * 60, endMin: 17 * 60 },
        { id: "p-day", name: "Büro 8–17", startMin: 8 * 60, endMin: 17 * 60 },
    ];
}

function isBlock(b: unknown): b is PersonalArbeitsBlock {
    return (
        b != null
        && typeof b === "object"
        && typeof (b as PersonalArbeitsBlock).id === "string"
        && typeof (b as PersonalArbeitsBlock).personalId === "string"
        && typeof (b as PersonalArbeitsBlock).date === "string"
        && typeof (b as PersonalArbeitsBlock).startMin === "number"
        && typeof (b as PersonalArbeitsBlock).endMin === "number"
        && typeof (b as PersonalArbeitsBlock).title === "string"
        && (b as PersonalArbeitsBlock).endMin > (b as PersonalArbeitsBlock).startMin
    );
}

function parseStoreV1(raw: string): ArbeitsplanStore {
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
        && Array.isArray(o.personalIds)
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

function migrateWeeklyToPlan(s: ArbeitsplanStore): ArbeitsplanStore {
    if (s.planPreferences.length > 0 || s.weeklyRules.length === 0) {
        return s;
    }
    const planPreferences: PlanPreference[] = s.weeklyRules.map((r) => ({
        id: r.id,
        name: "Soll (importiert aus Wochen-Regeln)",
        personalIds: [r.personalId],
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

function parseStoreV2(raw: string): ArbeitsplanStore | null {
    try {
        const j = JSON.parse(raw) as {
            blocks?: unknown;
            settings?: ArbeitsplanSettings;
            presets?: ArbeitszeitPreset[];
            weeklyRules?: WochenarbeitsRegel[];
            planPreferences?: unknown;
        };
        const blocks = Array.isArray(j.blocks) ? j.blocks.filter(isBlock) : [];
        const s = j.settings;
        const settings: ArbeitsplanSettings = s
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
                (p): p is ArbeitszeitPreset =>
                    p != null
                    && typeof (p as ArbeitszeitPreset).id === "string"
                    && typeof (p as ArbeitszeitPreset).name === "string"
                    && typeof (p as ArbeitszeitPreset).startMin === "number"
                    && typeof (p as ArbeitszeitPreset).endMin === "number"
                    && (p as ArbeitszeitPreset).endMin > (p as ArbeitszeitPreset).startMin,
            )
            : defaultPresets();
        const weeklyRules = Array.isArray(j.weeklyRules)
            ? j.weeklyRules.filter(
                (r): r is WochenarbeitsRegel =>
                    r != null
                    && typeof (r as WochenarbeitsRegel).id === "string"
                    && typeof (r as WochenarbeitsRegel).personalId === "string"
                    && typeof (r as WochenarbeitsRegel).weekday === "number"
                    && (r as WochenarbeitsRegel).weekday >= 1
                    && (r as WochenarbeitsRegel).weekday <= 7
                    && typeof (r as WochenarbeitsRegel).startMin === "number"
                    && typeof (r as WochenarbeitsRegel).endMin === "number"
                    && (r as WochenarbeitsRegel).endMin > (r as WochenarbeitsRegel).startMin,
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

export function loadArbeitsplanStore(): ArbeitsplanStore {
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
                    saveArbeitsplanStore(migratedWeekly);
                }
                return migratedWeekly;
            }
        }
        const v1 = localStorage.getItem(LS_KEY_V1);
        if (v1) {
            const migrated = parseStoreV1(v1);
            saveArbeitsplanStore(migrated);
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

export function saveArbeitsplanStore(s: ArbeitsplanStore): void {
    if (globalThis.localStorage == null) return;
    localStorage.setItem(LS_KEY_V2, JSON.stringify(s));
}

export function loadArbeitsplanBlocks(): PersonalArbeitsBlock[] {
    return loadArbeitsplanStore().blocks;
}

export function saveArbeitsplanBlocks(blocks: PersonalArbeitsBlock[]): void {
    const s = loadArbeitsplanStore();
    s.blocks = blocks;
    saveArbeitsplanStore(s);
}

export function deleteBlock(id: string): void {
    const s = loadArbeitsplanStore();
    s.blocks = s.blocks.filter((b) => b.id !== id);
    saveArbeitsplanStore(s);
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

/** Minuten seit Mitternacht aus Stunden 0–23, Min 0–59 */
export function timeToMin(h: number, m: number): number {
    return h * 60 + m;
}

export function minToLabel(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDeDate(ymd: string): string {
    try {
        return format(parseISO(ymd), "EEEE, d. MMM yyyy", { locale: de });
    } catch {
        return ymd;
    }
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
    personalId: string,
    ymdStr: string,
    rules: WochenarbeitsRegel[],
): WochenarbeitsRegel[] {
    const wd = isoWeekdayFromYmd(ymdStr);
    return rules.filter((r) => r.personalId === personalId && r.weekday === wd);
}

/** Einfache Farbe pro personalId (UI) — FNV-1a-artige Streuung über HSL-Hue. */
export function hueForPersonal(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % 360;
}
