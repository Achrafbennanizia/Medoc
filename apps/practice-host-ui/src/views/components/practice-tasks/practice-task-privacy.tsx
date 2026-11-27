/** Group record privacy on a practice task (T5.2). */
import type { PracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import { RecordPrivacy } from "@/views/components/record-privacy";

export function PracticeTaskPrivacy({ task }: { task: PracticeTask }) {
    return (
        <RecordPrivacy
            entityTable="practice_task"
            entityId={task.id}
            ownerId={task.doctor_id}
        />
    );
}
