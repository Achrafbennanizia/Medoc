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
    pauseMinutes?: number;
};

export type WorkTimeDaySummary = {
    date: string;
    workedMinutes: number;
    pauseMinutes: number;
};

export type WorkTimeWeekOverview = {
    weekStart: string;
    sessions: WorkTimeSession[];
    totalMinutes: number;
    days: WorkTimeDaySummary[];
};

export type WorkTimeActiveSession = {
    session: WorkTimeSession;
    elapsedMinutes: number;
    openPauseMinutes: number;
};

export type WorkTimeTeamMemberRow = {
    personalId: string;
    name: string;
    status: string;
    todayMinutes: number;
    weekMinutes: number;
};

export type WorkTimeTeamOverview = {
    weekStart: string;
    members: WorkTimeTeamMemberRow[];
};

export type WorkTimeStatistics = {
    weekMinutes: number;
    monthMinutes: number;
    pauseMinutesWeek: number;
    byDay: WorkTimeDaySummary[];
    byPerson: WorkTimeTeamMemberRow[];
};

export type WorkTimePreference = {
    focusMode: boolean;
    autoRecordOnLogin: boolean;
    autoRecordOnLogout: boolean;
};

export type WorkTimePreferencePatch = {
    focusMode?: boolean;
    autoRecordOnLogin?: boolean;
    autoRecordOnLogout?: boolean;
    personalId?: string | null;
};

export type WorkTimePracticePolicy = {
    autoRecordOnLogin: boolean;
    autoRecordOnLogout: boolean;
};

export type WorkTimePracticePolicyPatch = {
    autoRecordOnLogin?: boolean;
    autoRecordOnLogout?: boolean;
};

export type WorkTimeReconcileReport = {
    closedStaleCount: number;
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

export async function workTimeGetActiveSession(): Promise<WorkTimeActiveSession | null> {
    return practiceSystem.invoke<WorkTimeActiveSession | null>("work_time_get_active_session");
}

export async function workTimeGetWeekOverview(weekStart?: string): Promise<WorkTimeWeekOverview> {
    return practiceSystem.invoke<WorkTimeWeekOverview>("work_time_get_week_overview", {
        query: { weekStart: weekStart ?? null },
    });
}

export async function workTimeGetTeamOverview(weekStart?: string): Promise<WorkTimeTeamOverview> {
    return practiceSystem.invoke<WorkTimeTeamOverview>("work_time_get_team_overview", {
        query: { weekStart: weekStart ?? null },
    });
}

export async function workTimeGetStatistics(): Promise<WorkTimeStatistics> {
    return practiceSystem.invoke<WorkTimeStatistics>("work_time_get_statistics");
}

export async function workTimeGetPreference(personalId?: string): Promise<WorkTimePreference> {
    return practiceSystem.invoke<WorkTimePreference>("work_time_get_preference", {
        personal_id: personalId ?? null,
    });
}

export async function workTimeSetPreference(patch: WorkTimePreferencePatch): Promise<WorkTimePreference> {
    return practiceSystem.invoke<WorkTimePreference>("work_time_set_preference", { patch });
}

export async function workTimeGetPracticePolicy(): Promise<WorkTimePracticePolicy> {
    return practiceSystem.invoke<WorkTimePracticePolicy>("work_time_get_practice_policy");
}

export async function workTimeSetPracticePolicy(
    patch: WorkTimePracticePolicyPatch,
): Promise<WorkTimePracticePolicy> {
    return practiceSystem.invoke<WorkTimePracticePolicy>("work_time_set_practice_policy", { patch });
}

/** @deprecated Use {@link workTimeSetPracticePolicy}. */
export async function workTimeSetAutoRecordOnLogin(enabled: boolean): Promise<void> {
    await workTimeSetPracticePolicy({ autoRecordOnLogin: enabled });
}

/** @deprecated Use {@link workTimeGetPreference}. */
export async function workTimeGetAutoRecordOnLogin(): Promise<boolean> {
    const pref = await workTimeGetPreference();
    return pref.autoRecordOnLogin;
}

export async function workTimeReconcileOnLogin(): Promise<WorkTimeReconcileReport> {
    return practiceSystem.invoke<WorkTimeReconcileReport>("work_time_reconcile_on_login");
}
