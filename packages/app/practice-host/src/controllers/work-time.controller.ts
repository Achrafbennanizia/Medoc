import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type WorkTimeSession = {
    id: string;
    personalId: string;
    startedAt: string;
    endedAt?: string | null;
    pauseStartedAt?: string | null;
    status: "RUNNING" | "PAUSED" | "ENDED";
    autoRecorded: boolean;
    endReason?: string | null;
};

export type WorkTimeReconcileReport = {
    closedStaleCount: number;
};

export type WorkTimeWeekOverview = {
    weekStart: string;
    sessions: WorkTimeSession[];
    totalMinutes: number;
};

export async function workTimeStart(autoRecorded?: boolean): Promise<WorkTimeSession> {
    return practiceSystem.invoke<WorkTimeSession>("work_time_start", {
        autoRecorded: autoRecorded ?? false,
    });
}

export async function workTimePause(): Promise<WorkTimeSession> {
    return practiceSystem.invoke<WorkTimeSession>("work_time_pause");
}

export async function workTimeResume(): Promise<WorkTimeSession> {
    return practiceSystem.invoke<WorkTimeSession>("work_time_resume");
}

export async function workTimeEnd(): Promise<WorkTimeSession> {
    return practiceSystem.invoke<WorkTimeSession>("work_time_end");
}

export async function workTimeGetWeekOverview(weekStart?: string): Promise<WorkTimeWeekOverview> {
    return practiceSystem.invoke<WorkTimeWeekOverview>("work_time_get_week_overview", {
        query: { weekStart: weekStart ?? null },
    });
}

export async function workTimeSetAutoRecordOnLogin(enabled: boolean): Promise<void> {
    return practiceSystem.invoke<void>("work_time_set_auto_record_on_login", { enabled });
}

export async function workTimeGetAutoRecordOnLogin(): Promise<boolean> {
    return practiceSystem.invoke<boolean>("work_time_get_auto_record_on_login");
}

export async function workTimeReconcileOnLogin(): Promise<WorkTimeReconcileReport> {
    return practiceSystem.invoke<WorkTimeReconcileReport>("work_time_reconcile_on_login");
}
