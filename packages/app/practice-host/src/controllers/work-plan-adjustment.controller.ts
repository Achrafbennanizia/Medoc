import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type WorkPlanAdjustmentRecord = {
    id: string;
    source: string;
    sourceId?: string | null;
    staffId: string;
    payloadJson: string;
    active: boolean;
    createdAt: string;
};

export async function listWorkPlanAdjustments(opts?: {
    staffId?: string;
    activeOnly?: boolean;
}): Promise<WorkPlanAdjustmentRecord[]> {
    return practiceSystem.invoke<WorkPlanAdjustmentRecord[]>("list_work_plan_adjustments", {
        query: {
            staffId: opts?.staffId ?? null,
            activeOnly: opts?.activeOnly ?? true,
        },
    });
}
