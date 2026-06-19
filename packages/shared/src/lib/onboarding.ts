/**
 * NFA-USE-09 — Per-route onboarding hints (G6). Progress in SQLite `app_kv`.
 */

import type { Rolle } from "@/models/types";
import { getAppKvRaw, setAppKvRaw } from "@/systems/practice-host/controllers/app-kv.controller";

/** NFA-USE-09 acceptance threshold (≥80 % onboarding routes per role). */
export const ONBOARDING_MIN_COVERAGE_RATIO = 0.8;

export type OnboardingStep = {
    routePath: string;
    /** i18n key for step title */
    titleKey: string;
    /** i18n key for step body */
    bodyKey: string;
};

function step(routePath: string, titleKey: string, bodyKey: string): OnboardingStep {
    return { routePath, titleKey, bodyKey };
}

const STEPS_BY_ROLE: Record<Rolle, OnboardingStep[]> = {
    ARZT: [
        step("", "onboarding.arzt.home.title", "onboarding.arzt.home.body"),
        step("patienten", "onboarding.arzt.patienten.title", "onboarding.arzt.patienten.body"),
        step("akten/zu-validieren", "onboarding.arzt.akten_validieren.title", "onboarding.arzt.akten_validieren.body"),
        step("termine", "onboarding.arzt.termine.title", "onboarding.arzt.termine.body"),
        step("rezepte", "onboarding.arzt.rezepte.title", "onboarding.arzt.rezepte.body"),
        step("atteste", "onboarding.arzt.atteste.title", "onboarding.arzt.atteste.body"),
        step("audit", "onboarding.arzt.audit.title", "onboarding.arzt.audit.body"),
        step("statistik", "onboarding.arzt.statistik.title", "onboarding.arzt.statistik.body"),
        step("einstellungen", "onboarding.arzt.einstellungen.title", "onboarding.arzt.einstellungen.body"),
    ],
    REZEPTION: [
        step("", "onboarding.rezeption.home.title", "onboarding.rezeption.home.body"),
        step("patienten", "onboarding.rezeption.patienten.title", "onboarding.rezeption.patienten.body"),
        step("termine", "onboarding.rezeption.termine.title", "onboarding.rezeption.termine.body"),
        step("tickets", "onboarding.rezeption.tickets.title", "onboarding.rezeption.tickets.body"),
        step("bestellungen", "onboarding.rezeption.bestellungen.title", "onboarding.rezeption.bestellungen.body"),
        step("finanzen", "onboarding.rezeption.finanzen.title", "onboarding.rezeption.finanzen.body"),
        step("einstellungen", "onboarding.rezeption.einstellungen.title", "onboarding.rezeption.einstellungen.body"),
    ],
    STEUERBERATER: [],
    PHARMABERATER: [],
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
