import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type ArbeitsplanAdjustmentRecord = {
    id: string;
    source: string;
    sourceId?: string | null;
    personalId: string;
    payloadJson: string;
    active: boolean;
    createdAt: string;
};

export async function listArbeitsplanAdjustments(opts?: {
    personalId?: string;
    activeOnly?: boolean;
}): Promise<ArbeitsplanAdjustmentRecord[]> {
    return practiceSystem.invoke<ArbeitsplanAdjustmentRecord[]>("list_arbeitsplan_adjustments", {
        query: {
            personalId: opts?.personalId ?? null,
            activeOnly: opts?.activeOnly ?? true,
        },
    });
}
