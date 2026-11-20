import type { PracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { taskStatusVariant } from "./task-workflow";
import { useT, useTParams } from "@/lib/i18n";
import { practiceTaskHeadline, practiceTaskPreview } from "@/lib/practice-task-display";
import { taskStatusLabel, taskKindLabel } from "./task-workflow-ui";

type Props = {
    task: PracticeTask;
    patientName: string;
    selected?: boolean;
    canOpen?: boolean;
    onOpen: () => void;
};

export function PracticeTaskInboxRow({
    task,
    patientName,
    selected = false,
    canOpen = true,
    onOpen,
}: Props) {
    const t = useT();
    const tp = useTParams();
    const headline = practiceTaskHeadline(task, t);
    const preview = practiceTaskPreview(task, t, tp);
    return (
        <button
            type="button"
            className={[
                "practice-task-inbox-row",
                selected ? "practice-task-inbox-row--selected" : "",
                !canOpen ? "practice-task-inbox-row--disabled" : "",
            ]
                .filter(Boolean)
                .join(" ")}
            onClick={canOpen ? onOpen : undefined}
            disabled={!canOpen}
            aria-pressed={canOpen ? selected : undefined}
            aria-disabled={!canOpen}
        >
            <div className="practice-task-inbox-row__main">
                <div className="practice-task-inbox-row__title" dir="auto">
                    {headline}
                </div>
                <div className="practice-task-inbox-row__sub">
                    <span className="practice-task-inbox-row__name" dir="auto">
                        {patientName}
                    </span>
                    {" · "}
                    {taskKindLabel(t, task.kind)}
                    {" · "}
                    {formatDateTime(task.updated_at)}
                </div>
                {preview ? (
                    <div className="practice-task-inbox-row__preview" dir="auto">
                        {preview}
                    </div>
                ) : null}
            </div>
            <Badge variant={taskStatusVariant(task.status)}>{taskStatusLabel(t, task.status)}</Badge>
        </button>
    );
}
