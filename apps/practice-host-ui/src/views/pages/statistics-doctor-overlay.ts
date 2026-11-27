/** Pure helpers for Cabinet+ per-doctor statistics overlays (kept out of the chart component file). */
import type { DoctorMonthSeries } from "@/models/types";

export function statisticsDoctorOverlayActive(
    showDoctorUi: boolean,
    doctorId: string,
    series: DoctorMonthSeries[] | undefined,
): boolean {
    return showDoctorUi && !doctorId && (series?.length ?? 0) >= 2;
}
