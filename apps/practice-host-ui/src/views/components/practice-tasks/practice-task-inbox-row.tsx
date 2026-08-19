import type { PracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { taskStatusVariant } from "./task-workflow";
import { useT } from "@/lib/i18n";
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
                <div className="practice-task-inbox-row__title">{task.title}</div>
                <div className="practice-task-inbox-row__sub">
                    {patientName} · {taskKindLabel(t, task.kind)} · {formatDateTime(task.updated_at)}
                </div>
                {task.body ? <div className="practice-task-inbox-row__preview">{task.body}</div> : null}
            </div>
            <Badge variant={taskStatusVariant(task.status)}>{taskStatusLabel(t, task.status)}</Badge>
        </button>
    );
}