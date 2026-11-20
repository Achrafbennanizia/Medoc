import type { PracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import { useT } from "@/lib/i18n";
import { ticketTitleIsMessage } from "@/lib/practice-task-display";

export type PracticeTaskTicketFormProps = {
    task: PracticeTask;
    patientName: string;
    creatorLabel: string;
};

/** Message-oriented layout for reception → physician tickets (simple track). */
export function PracticeTaskTicketForm({
    task,
    patientName,
    creatorLabel,
}: PracticeTaskTicketFormProps) {
    const t = useT();
    const body = (task.body ?? "").trim();
    const message =
        body ||
        (ticketTitleIsMessage(task) ? (task.title ?? "").trim() : "") ||
        t("common.dash");
    return (
        <div className="practice-task-ticket-fields">
            <div className="appointment-drawer-section">
                <div className="appointment-drawer-eyebrow">
                    {t("practice.tasks.drawer.ticket_from")}
                </div>
                <p className="appointment-drawer-meta-val">{creatorLabel}</p>
            </div>
            <div className="appointment-drawer-section">
                <div className="appointment-drawer-eyebrow">
                    {t("practice.tasks.drawer.ticket_patient")}
                </div>
                <p className="appointment-drawer-meta-val">{patientName}</p>
            </div>
            <div className="appointment-drawer-section">
                <div className="appointment-drawer-eyebrow">
                    {t("practice.tasks.drawer.ticket_message")}
                </div>
                <p className="appointment-drawer-meta-val" style={{ whiteSpace: "pre-wrap" }} dir="auto">
                    {message}
                </p>
            </div>
        </div>
    );
}
