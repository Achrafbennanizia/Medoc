import { tauriInvoke } from "@/services/tauri.service";

/** Must match `BREAK_GLASS_DURATION` in `application::break_glass` (Rust). */
export const BREAK_GLASS_WINDOW_SECS = 30 * 60;

export interface BreakGlassEntry {
    user_id: string;
    reason: string;
    patient_id: string | null;
    elapsed_secs: number;
}

export async function breakGlassActivate(reason: string, patientId?: string | null): Promise<void> {
    await tauriInvoke<void>("break_glass_activate", { reason, patient_id: patientId ?? null });
}

export async function breakGlassActive(): Promise<BreakGlassEntry[]> {
    return tauriInvoke<BreakGlassEntry[]>("break_glass_active");
}
