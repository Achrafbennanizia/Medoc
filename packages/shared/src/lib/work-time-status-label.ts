/** Label for a work-time state (running / paused / off); unknown states are shown as they are. */
export function workTimeStatusLabel(status: string, t: (key: string) => string): string {
    if (status === "RUNNING") return t("page.workTime.status.active");
    if (status === "PAUSED") return t("page.workTime.status.paused");
    if (status === "AUS") return t("page.workTime.status.off");
    return status;
}
