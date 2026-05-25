/**
 * NFA-USE-09 — Per-route onboarding hints (G6). Progress in SQLite `app_kv`.
 */

import type { Rolle } from "@/models/types";
import { getAppKvRaw, setAppKvRaw } from "@/controllers/app-kv.controller";

/** NFA-USE-09 acceptance threshold (≥80 % onboarding routes per role). */
export const ONBOARDING_MIN_COVERAGE_RATIO = 0.8;

export type OnboardingStep = {
    routePath: string;
    titleDe: string;
    bodyDe: string;
};

const STEPS_BY_ROLE: Record<Rolle, OnboardingStep[]> = {
    ARZT: [
        { routePath: "", titleDe: "Dashboard", bodyDe: "KPIs, offene Bestellungen und Freigaben auf einen Blick." },
        { routePath: "patienten", titleDe: "Patienten", bodyDe: "Stammdaten, Akten-Tabs und klinische Dokumentation pro Patient." },
        { routePath: "akten/zu-validieren", titleDe: "Akten validieren", bodyDe: "Warteschlange für Akten im Status Entwurf oder in Bearbeitung." },
        { routePath: "termine", titleDe: "Termine", bodyDe: "Kalender mit Konfliktprüfung; Notfall-Filter über Termin-Metadaten." },
        { routePath: "rezepte", titleDe: "Rezepte", bodyDe: "Rezeptausstellung mit Vorlagen und Kombinationsrezepten." },
        { routePath: "atteste", titleDe: "Atteste", bodyDe: "Arbeitsunfähigkeits- und Bescheinigungsdokumente." },
        { routePath: "audit", titleDe: "Audit", bodyDe: "Nachvollziehbarkeit von Lese- und Schreibzugriffen." },
        { routePath: "statistik", titleDe: "Statistik", bodyDe: "Auswertungen und CSV-Export für Praxissteuerung." },
        { routePath: "einstellungen", titleDe: "Einstellungen", bodyDe: "Praxis, Sicherheit, Backups und Integrationen." },
    ],
    REZEPTION: [
        { routePath: "", titleDe: "Dashboard", bodyDe: "Tagesüberblick: Termine, Bestellungen, Stammdaten-Prüfung." },
        { routePath: "patienten", titleDe: "Patienten", bodyDe: "Patienten anlegen und Akten für die Behandlung vorbereiten." },
        { routePath: "termine", titleDe: "Termine", bodyDe: "Termine planen und Status pflegen." },
        { routePath: "tickets", titleDe: "Praxis-Tickets", bodyDe: "Nachrichten und Aufträge an Ärzt:innen." },
        { routePath: "bestellungen", titleDe: "Bestellungen", bodyDe: "Lager und Nachbestellungen verwalten." },
        { routePath: "finanzen", titleDe: "Finanzen", bodyDe: "Zahlungserfassung (ohne ärztliche Freigabe der Leistung)." },
        { routePath: "einstellungen", titleDe: "Einstellungen", bodyDe: "Darstellung, Arbeitsabläufe und Benachrichtigungen." },
    ],
    STEUERBERATER: [
        { routePath: "", titleDe: "Dashboard", bodyDe: "Finanz-KPIs und Export-Hinweise." },
        { routePath: "bilanz", titleDe: "Bilanz", bodyDe: "Bilanzübersicht und Berichte." },
        { routePath: "finanzen", titleDe: "Finanzen", bodyDe: "Zahlungsübersicht ohne klinische Akten-Details." },
    ],
    PHARMABERATER: [
        { routePath: "", titleDe: "Dashboard", bodyDe: "Bestell- und Produkt-KPIs." },
        { routePath: "produkte", titleDe: "Produkte", bodyDe: "Lagerbestände und Mindestbestände." },
        { routePath: "bestellungen", titleDe: "Bestellungen", bodyDe: "Bestellstatus und Nachbestellung." },
    ],
};

export function onboardingKvKey(rolle: Rolle): string {
    return `onboarding.progress.v1.${rolle.toLowerCase()}`;
}

export type OnboardingProgress = { completedRoutes: string[] };

function parseProgress(raw: string | null): OnboardingProgress {
    if (!raw?.trim()) return { completedRoutes: [] };
    try {
        const j = JSON.parse(raw) as OnboardingProgress;
        if (Array.isArray(j.completedRoutes)) {
            return { completedRoutes: j.completedRoutes.filter((r) => typeof r === "string") };
        }
    } catch {
        /* ignore */
    }
    return { completedRoutes: [] };
}

export function stepsForRole(rolle: Rolle | undefined): OnboardingStep[] {
    if (!rolle) return [];
    return STEPS_BY_ROLE[rolle] ?? [];
}

export function coverageRatio(rolle: Rolle, completed: string[]): number {
    const steps = stepsForRole(rolle);
    if (steps.length === 0) return 1;
    const set = new Set(completed);
    const done = steps.filter((s) => set.has(s.routePath)).length;
    return done / steps.length;
}

export function meetsOnboardingCoverageTarget(rolle: Rolle, completed: string[]): boolean {
    return coverageRatio(rolle, completed) >= ONBOARDING_MIN_COVERAGE_RATIO;
}

/** Routes required to reach {@link ONBOARDING_MIN_COVERAGE_RATIO} for a role (ceil). */
export function routesRequiredForTarget(rolle: Rolle): number {
    const n = stepsForRole(rolle).length;
    if (n === 0) return 0;
    return Math.ceil(n * ONBOARDING_MIN_COVERAGE_RATIO);
}

export async function loadOnboardingProgress(rolle: Rolle): Promise<OnboardingProgress> {
    const raw = await getAppKvRaw(onboardingKvKey(rolle));
    return parseProgress(raw);
}

export async function markOnboardingRouteDone(rolle: Rolle, routePath: string): Promise<OnboardingProgress> {
    const cur = await loadOnboardingProgress(rolle);
    const set = new Set(cur.completedRoutes);
    set.add(routePath);
    const next = { completedRoutes: [...set] };
    await setAppKvRaw(onboardingKvKey(rolle), JSON.stringify(next));
    return next;
}

export async function resetOnboardingProgress(rolle: Rolle): Promise<void> {
    await setAppKvRaw(onboardingKvKey(rolle), JSON.stringify({ completedRoutes: [] }));
}

export { routePathFromLocation } from "./rbac";

export function stepForRoute(rolle: Rolle | undefined, routePath: string): OnboardingStep | undefined {
    const steps = stepsForRole(rolle);
    const exact = steps.find((s) => s.routePath === routePath);
    if (exact) return exact;
    return steps.find((s) => s.routePath.length > 0 && routePath.startsWith(`${s.routePath}/`));
}
