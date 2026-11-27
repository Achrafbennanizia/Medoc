import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { DashboardStats, StatisticsOverview } from "@/models/types";

export type { DashboardStats, StatisticsOverview };

export async function getDashboardStats(): Promise<DashboardStats> {
    return practiceSystem.invoke<DashboardStats>("get_dashboard_stats");
}

/** `doctorId` narrows the figures to one doctor (Group); empty or omitted = everyone you may see. */
export async function getStatisticsOverview(doctorId?: string): Promise<StatisticsOverview> {
    return practiceSystem.invoke<StatisticsOverview>("get_statistics_overview", { doctorId: doctorId || null });
}
