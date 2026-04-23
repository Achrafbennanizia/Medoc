import { tauriInvoke } from "@/services/tauri.service";
import type { DashboardStats } from "@/models/types";

export type { DashboardStats };

export async function getDashboardStats(): Promise<DashboardStats> {
    return tauriInvoke<DashboardStats>("get_dashboard_stats");
}
