/**
 * Which capability-gated feature module owns which route (docs/architecture/editions-plan.md §3.3).
 *
 * Routes not listed belong to the core of every edition. A route whose module is off in this
 * build is refused everywhere the route list is used: route guard and command palette
 * ({@link import("./rbac").routeChildPathAllowed}), sidebar, native "Go to" menu. `App.tsx`
 * also skips loading the page so its chunk is left out of the bundle.
 *
 * Keys are {@link import("./rbac").ROUTE_VISIBILITY} route paths.
 */
import type { Capability } from "./edition.generated";

export type FeatureModule = {
    id: string;
    capability: Capability;
    /** Build-time literal (`__CAP_*__`). */
    enabled: boolean;
    routes: readonly string[];
};

export const FEATURE_MODULES: readonly FeatureModule[] = [
    {
        id: "tasks",
        capability: "tasks",
        enabled: __CAP_TASKS__,
        routes: ["tickets", "tickets/new", "tickets/:id/edit", "tickets/:id/bearbeiten", "administration/tasks"],
    },
    {
        id: "chart-validation",
        capability: "validation",
        enabled: __CAP_VALIDATION__,
        routes: ["charts/to-validate"],
    },
    {
        id: "team",
        capability: "multiStaff",
        enabled: __CAP_MULTI_STAFF__,
        routes: ["staff", "staff/new", "administration/team"],
    },
    {
        id: "work-time",
        capability: "workTime",
        enabled: __CAP_WORK_TIME__,
        routes: ["staff/work-time", "staff/work-plan", "administration/team/work-time", "administration/sick-leave-certificate"],
    },
    {
        id: "day-close",
        capability: "dayClose",
        enabled: __CAP_DAY_CLOSE__,
        routes: ["administration/finance-reports/day-close", "administration/day-close"],
    },
];

const OFF_ROUTES: ReadonlySet<string> = new Set(
    FEATURE_MODULES.filter((m) => !m.enabled).flatMap((m) => m.routes),
);

/** False when the route belongs to a feature module this edition does not have. */
export function routeEnabledInEdition(routePath: string): boolean {
    return !OFF_ROUTES.has(routePath);
}

/** Owning module of a route, if it is not part of the core. */
export function featureModuleOfRoute(routePath: string): FeatureModule | undefined {
    return FEATURE_MODULES.find((m) => m.routes.includes(routePath));
}
