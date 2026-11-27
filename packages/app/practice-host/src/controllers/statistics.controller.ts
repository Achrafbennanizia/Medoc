import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { DashboardStats, StatisticsOverview } from "@/models/types";

export type { DashboardStats, StatisticsOverview };

export type StatisticsOverviewQuery = {
    doctorId?: string;
    treatmentKind?: string;
    paymentMethod?: string;
};

export async function getDashboardStats(): Promise<DashboardStats> {
    return practiceSystem.invoke<DashboardStats>("get_dashboard_stats");
}

/** `doctorId` narrows the figures to one doctor (Group); empty or omitted = everyone you may see. */
export async function getStatisticsOverview(query?: string | StatisticsOverviewQuery): Promise<StatisticsOverview> {
    const args =
        typeof query === "string" || query === undefined
            ? {
                  doctorId: typeof query === "string" ? query || null : null,
                  treatmentKind: null,
                  paymentMethod: null,
              }
            : {
                  doctorId: query.doctorId || null,
                  treatmentKind: query.treatmentKind || null,
                  paymentMethod: query.paymentMethod || null,
              };
    return practiceSystem.invoke<StatisticsOverview>("get_statistics_overview", args);
}