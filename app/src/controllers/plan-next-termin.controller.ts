import { tauriInvoke } from "@/services/tauri.service";
import {
    emptyPlanNextTermin,
    type PlanNextTerminV2,
} from "@/lib/plan-next-termin";

const V2_PREFIX = "medoc.akte.plan.v2.";
const V1_PREFIX = "medoc.akte.tipp.v1.";

function legacyKeyV2(patientId: string): string {
    return `${V2_PREFIX}${patientId}`;
}

function loadPlanFromLegacyLocalStorage(patientId: string): PlanNextTerminV2 | null {
    if (typeof window === "undefined" || !patientId) return null;
    try {
        const raw = window.localStorage.getItem(legacyKeyV2(patientId));
        if (raw) {
            const p = JSON.parse(raw) as Partial<PlanNextTerminV2>;
            if (p && typeof p === "object") {
                return {
                    freeText: typeof p.freeText === "string" ? p.freeText : "",
                    urgency:
                        p.urgency === "bald" || p.urgency === "dringend" || p.urgency === "routine"
                            ? p.urgency
                            : "routine",
                    intervalWeeks: typeof p.intervalWeeks === "string" ? p.intervalWeeks : "",
                    terminArtHint: typeof p.terminArtHint === "string" ? p.terminArtHint : "",
                    durationMin: typeof p.durationMin === "string" ? p.durationMin : "",
                    preferredWeekdays: typeof p.preferredWeekdays === "string" ? p.preferredWeekdays : "",
                    internalNote: typeof p.internalNote === "string" ? p.internalNote : "",
                };
            }
        }
        const legacy = window.localStorage.getItem(`${V1_PREFIX}${patientId}`);
        if (legacy?.trim()) {
            return { ...emptyPlanNextTermin(), freeText: legacy };
        }
    } catch {
        /* ignore */
    }
    return null;
}

function stripLegacyPlanLocalStorage(patientId: string): void {
    try {
        window.localStorage.removeItem(legacyKeyV2(patientId));
        window.localStorage.removeItem(`${V1_PREFIX}${patientId}`);
    } catch {
        /* ignore */
    }
}

export async function getPlanNextTerminFromBackend(patientId: string): Promise<PlanNextTerminV2> {
    const pid = typeof patientId === "string" ? patientId.trim() : "";
    if (!pid) {
        return emptyPlanNextTermin();
    }
    const dto = await tauriInvoke<Record<string, unknown> | null>("get_akte_next_termin_hint", {
        patientId: pid,
    });
    const hintJoined = dto && typeof dto === "object" ? (dto.hintJson ?? dto.hint_json) : undefined;
    const hintRaw = typeof hintJoined === "string" ? hintJoined.trim() : "";
    if (!hintRaw) {
        return emptyPlanNextTermin();
    }
    try {
        const p = JSON.parse(hintRaw) as Partial<PlanNextTerminV2>;
        if (p && typeof p === "object") {
            return {
                freeText: typeof p.freeText === "string" ? p.freeText : "",
                urgency:
                    p.urgency === "bald" || p.urgency === "dringend" || p.urgency === "routine"
                        ? p.urgency
                        : "routine",
                intervalWeeks: typeof p.intervalWeeks === "string" ? p.intervalWeeks : "",
                terminArtHint: typeof p.terminArtHint === "string" ? p.terminArtHint : "",
                durationMin: typeof p.durationMin === "string" ? p.durationMin : "",
                preferredWeekdays: typeof p.preferredWeekdays === "string" ? p.preferredWeekdays : "",
                internalNote: typeof p.internalNote === "string" ? p.internalNote : "",
            };
        }
    } catch {
        /* ignore */
    }
    return emptyPlanNextTermin();
}

export async function persistPlanNextTerminToBackend(
    patientId: string,
    plan: PlanNextTerminV2,
): Promise<void> {
    const pid = typeof patientId === "string" ? patientId.trim() : "";
    if (!pid) {
        return;
    }
    const hasAny =
        plan.freeText.trim()
        || plan.intervalWeeks.trim()
        || plan.terminArtHint.trim()
        || plan.durationMin.trim()
        || plan.preferredWeekdays.trim()
        || plan.internalNote.trim()
        || plan.urgency !== "routine";
    const payload = hasAny ? JSON.stringify(plan) : "{}";
    await tauriInvoke<void>("set_akte_next_termin_hint", {
        patientId: pid,
        hintJson: payload,
    });
}

/** Load from DB, migrating legacy browser storage once when the backend row is empty. */
export async function loadPlanNextTerminWithMigration(patientId: string): Promise<PlanNextTerminV2> {
    const pid = typeof patientId === "string" ? patientId.trim() : "";
    if (!pid) {
        return emptyPlanNextTermin();
    }
    const fromServer = await getPlanNextTerminFromBackend(pid);
    const hasServer = Boolean(
        fromServer.freeText.trim()
            || fromServer.intervalWeeks.trim()
            || fromServer.terminArtHint.trim()
            || fromServer.durationMin.trim()
            || fromServer.preferredWeekdays.trim()
            || fromServer.internalNote.trim()
            || fromServer.urgency !== "routine",
    );
    if (hasServer) {
        return fromServer;
    }
    const legacy = loadPlanFromLegacyLocalStorage(pid);
    if (legacy) {
        await persistPlanNextTerminToBackend(pid, legacy);
        stripLegacyPlanLocalStorage(pid);
        return legacy;
    }
    return emptyPlanNextTermin();
}

export function stripLegacyPlanNextTerminLocalStorage(patientId: string): void {
    if (!patientId || typeof window === "undefined") return;
    stripLegacyPlanLocalStorage(patientId);
}
