/**
 * NFA-USE-09 — Per-route onboarding hints (G6). Progress in SQLite `app_kv`.
 */

import type { Role } from "@/models/types";
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

const STEPS_BY_ROLE: Record<Role, OnboardingStep[]> = {
    PHYSICIAN: [
        step("", "onboarding.physician.home.title", "onboarding.physician.home.body"),
        step("patients", "onboarding.physician.patients.title", "onboarding.physician.patients.body"),
        step("charts/to-validate", "onboarding.physician.charts_validate.title", "onboarding.physician.charts_validate.body"),
        step("appointments", "onboarding.physician.appointments.title", "onboarding.physician.appointments.body"),
        step("prescriptions", "onboarding.physician.prescriptions.title", "onboarding.physician.prescriptions.body"),
        step("certificates", "onboarding.physician.certificates.title", "onboarding.physician.certificates.body"),
        step("audit", "onboarding.physician.audit.title", "onboarding.physician.audit.body"),
        step("statistics", "onboarding.physician.statistics.title", "onboarding.physician.statistics.body"),
        step("settings", "onboarding.physician.settings.title", "onboarding.physician.settings.body"),
    ],
    RECEPTION: [
        step("", "onboarding.reception.home.title", "onboarding.reception.home.body"),
        step("patients", "onboarding.reception.patients.title", "onboarding.reception.patients.body"),
        step("appointments", "onboarding.reception.appointments.title", "onboarding.reception.appointments.body"),
        step("tickets", "onboarding.reception.tickets.title", "onboarding.reception.tickets.body"),
        step("purchase-orders", "onboarding.reception.purchase-orders.title", "onboarding.reception.purchase-orders.body"),
        step("finance", "onboarding.reception.finance.title", "onboarding.reception.finance.body"),
        step("settings", "onboarding.reception.settings.title", "onboarding.reception.settings.body"),
    ],
    TAX_ADVISOR: [],
    PHARMA_CONSULTANT: [],
};

export function onboardingKvKey(role: Role): string {
    return `onboarding.progress.v1.${role.toLowerCase()}`;
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

export function stepsForRole(role: Role | undefined): OnboardingStep[] {
    if (!role) return [];
    return STEPS_BY_ROLE[role] ?? [];
}

export function coverageRatio(role: Role, completed: string[]): number {
    const steps = stepsForRole(role);
    if (steps.length === 0) return 1;
    const set = new Set(completed);
    const done = steps.filter((s) => set.has(s.routePath)).length;
    return done / steps.length;
}

export function meetsOnboardingCoverageTarget(role: Role, completed: string[]): boolean {
    return coverageRatio(role, completed) >= ONBOARDING_MIN_COVERAGE_RATIO;
}

/** Routes required to reach {@link ONBOARDING_MIN_COVERAGE_RATIO} for a role (ceil). */
export function routesRequiredForTarget(role: Role): number {
    const n = stepsForRole(role).length;
    if (n === 0) return 0;
    return Math.ceil(n * ONBOARDING_MIN_COVERAGE_RATIO);
}

export async function loadOnboardingProgress(role: Role): Promise<OnboardingProgress> {
    const raw = await getAppKvRaw(onboardingKvKey(role));
    return parseProgress(raw);
}

export async function markOnboardingRouteDone(role: Role, routePath: string): Promise<OnboardingProgress> {
    const cur = await loadOnboardingProgress(role);
    const set = new Set(cur.completedRoutes);
    set.add(routePath);
    const next = { completedRoutes: [...set] };
    await setAppKvRaw(onboardingKvKey(role), JSON.stringify(next));
    return next;
}

export async function resetOnboardingProgress(role: Role): Promise<void> {
    await setAppKvRaw(onboardingKvKey(role), JSON.stringify({ completedRoutes: [] }));
}

export { routePathFromLocation } from "./rbac";

export function stepForRoute(role: Role | undefined, routePath: string): OnboardingStep | undefined {
    const steps = stepsForRole(role);
    const exact = steps.find((s) => s.routePath === routePath);
    if (exact) return exact;
    return steps.find((s) => s.routePath.length > 0 && routePath.startsWith(`${s.routePath}/`));
}
