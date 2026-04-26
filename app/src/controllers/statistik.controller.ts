import { tauriInvoke } from "@/services/tauri.service";
import type { DashboardStats, StatistikOverview } from "@/models/types";

export type { DashboardStats, StatistikOverview };

export async function getDashboardStats(): Promise<DashboardStats> {
    return tauriInvoke<DashboardStats>("get_dashboard_stats");
}

export async function getStatistikOverview(): Promise<StatistikOverview> {
    return tauriInvoke<StatistikOverview>("get_statistik_overview");
}
