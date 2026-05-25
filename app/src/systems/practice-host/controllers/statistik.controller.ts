import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { DashboardStats, StatistikOverview } from "@/models/types";

export type { DashboardStats, StatistikOverview };

export async function getDashboardStats(): Promise<DashboardStats> {
    return practiceSystem.invoke<DashboardStats>("get_dashboard_stats");
}

export async function getStatistikOverview(): Promise<StatistikOverview> {
    return practiceSystem.invoke<StatistikOverview>("get_statistik_overview");
}
