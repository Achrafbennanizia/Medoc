import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { DashboardStats, StatisticsOverview } from "@/models/types";

export type { DashboardStats, StatisticsOverview };

export async function getDashboardStats(): Promise<DashboardStats> {
    return practiceSystem.invoke<DashboardStats>("get_dashboard_stats");
}

export async function getStatisticsOverview(): Promise<StatisticsOverview> {
    return practiceSystem.invoke<StatisticsOverview>("get_statistics_overview");
}
