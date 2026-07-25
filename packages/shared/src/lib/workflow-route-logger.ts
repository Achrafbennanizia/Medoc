import { tauriInvoke } from "@/services/tauri.service";

/**
 * Route-level workflow tracing is best-effort: telemetry failures must never
 * break navigation or tests.
 */
export async function logWorkflowRouteEnterBestEffort(route: string): Promise<void> {
    try {
        await tauriInvoke<void>("log_workflow_event", {
            input: {
                stage: "route_enter",
                route,
            },
        });
    } catch {
        // Ignore telemetry errors by design.
    }
}
