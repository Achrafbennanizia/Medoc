import { tauriInvoke } from "@/services/tauri.service";

export interface BreakGlassEntry {
    user_id: string;
    reason: string;
    patient_id: string | null;
    elapsed_secs: number;
}

export async function breakGlassActivate(reason: string, patientId?: string | null): Promise<void> {
    await tauriInvoke<void>("break_glass_activate", { reason, patientId: patientId ?? null });
}

export async function breakGlassActive(): Promise<BreakGlassEntry[]> {
    return tauriInvoke<BreakGlassEntry[]>("break_glass_active");
}
