import type { PracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import { useT, useTParams } from "@/lib/i18n";
import { displayPracticeTaskBody } from "@/lib/practice-task-display";

export type PracticeTaskAppointmentNoteFormProps = {
    task: PracticeTask;
    patientName: string;
    creatorLabel: string;
};

/** Physician → reception note / plan-next body (simple track). */
export function PracticeTaskAppointmentNoteForm({
    task,
    patientName,
    creatorLabel,
}: PracticeTaskAppointmentNoteFormProps) {
    const t = useT();
    const tp = useTParams();
    const raw = (task.body ?? task.title).trim();
    const note = raw ? displayPracticeTaskBody(raw, t, tp) : t("common.dash");
    return (
        <>
            <div className="appointment-drawer-section">
                <div className="appointment-drawer-eyebrow">
                    {t("practice.tasks.drawer.note_from")}
                </div>
                <p className="appointment-drawer-meta-val" style={{ margin: "4px 0 0" }}>
                    {creatorLabel}
                </p>
            </div>
            <div className="appointment-drawer-section">
                <div className="appointment-drawer-eyebrow">
                    {t("practice.tasks.drawer.note_patient")}
                </div>
                <p className="appointment-drawer-meta-val" style={{ margin: "4px 0 0" }}>
                    {patientName}
                </p>
            </div>
            <div className="appointment-drawer-section">
                <div className="appointment-drawer-eyebrow">
                    {t("practice.tasks.drawer.note_body")}
                </div>
                <p
                    className="appointment-drawer-meta-val"
                    style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}
                    dir="auto"
                >
                    {note}
                </p>
            </div>
        </>
    );
}
