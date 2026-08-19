import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type PracticeTaskKind =
    | "BILLING"
    | "APPOINTMENT"
    | "PRINT"
    | "MASTER_DATA"
    | "OTHER";

export type PracticeTaskStatus =
    | "OPEN"
    | "IN_PROGRESS"
    | "DONE_RECEPTION"
    | "VALIDATED"
    | "BACK";

export type PracticeTask = {
    id: string;
    patient_id: string | null;
    kind: PracticeTaskKind;
    title: string;
    body: string | null;
    assignee_role: string | null;
    assignee_user_id: string | null;
    created_by: string;
    treatment_id: string | null;
    examination_id: string | null;
    service_name: string | null;
    total_cost: number | null;
    payment_id: string | null;
    done_note: string | null;
    return_reason: string | null;
    status: PracticeTaskStatus;
    legacy_ticket_id: string | null;
    created_at: string;
    updated_at: string;
};

export type PracticeTaskComment = {
    id: string;
    task_id: string;
    author_id: string;
    body: string;
    created_at: string;
};

export async function createPracticeTask(data: {
    patientId: string;
    kind: PracticeTaskKind;
    title: string;
    body?: string | null;
    assigneeRole?: "RECEPTION" | null;
    assigneeUserId?: string | null;
    treatmentId?: string | null;
    examinationId?: string | null;
    service_name?: string | null;
    total_cost?: number | null;
}): Promise<PracticeTask> {
    return practiceSystem.invoke<PracticeTask>("create_practice_task", {
        data: {
            patientId: data.patientId,
            kind: data.kind,
            title: data.title,
            body: data.body ?? null,
            assigneeRole: data.assigneeRole ?? null,
            assigneeUserId: data.assigneeUserId ?? null,
            treatmentId: data.treatmentId ?? null,
            examinationId: data.examinationId ?? null,
            service_name: data.service_name ?? null,
            total_cost: data.total_cost ?? null,
        },
    });
}

export async function listPracticeTasksForMe(): Promise<PracticeTask[]> {
    return practiceSystem.invoke<PracticeTask[]>("list_practice_tasks_for_me");
}

export async function transitionPracticeTask(args: {
    id: string;
    status: PracticeTaskStatus;
    doneNote?: string | null;
    paymentId?: string | null;
    returnReason?: string | null;
}): Promise<PracticeTask> {
    return practiceSystem.invoke<PracticeTask>("transition_practice_task", {
        args: {
            id: args.id,
            status: args.status,
            doneNote: args.doneNote ?? null,
            paymentId: args.paymentId ?? null,
            returnReason: args.returnReason ?? null,
        },
    });
}

export async function countOpenPracticeTasksForMe(): Promise<number> {
    return practiceSystem.invoke<number>("count_open_practice_tasks_for_me");
}

export async function listPracticeTasksAdmin(): Promise<PracticeTask[]> {
    return practiceSystem.invoke<PracticeTask[]>("list_practice_tasks_admin");
}

export async function createPracticeTaskAdmin(data: {
    patientId: string | null;
    kind: PracticeTaskKind;
    title: string;
    body?: string | null;
    assigneeRole?: "RECEPTION" | null;
    assigneeUserId?: string | null;
}): Promise<PracticeTask> {
    return practiceSystem.invoke<PracticeTask>("create_practice_task_admin", {
        data: {
            patientId: data.patientId,
            kind: data.kind,
            title: data.title,
            body: data.body ?? null,
            assigneeRole: data.assigneeRole ?? null,
            assigneeUserId: data.assigneeUserId ?? null,
        },
    });
}

export async function updatePracticeTaskAdmin(patch: {
    id: string;
    title?: string;
    body?: string | null;
    kind?: PracticeTaskKind;
    assigneeRole?: "RECEPTION" | null;
    assigneeUserId?: string | null;
    status?: PracticeTaskStatus;
}): Promise<PracticeTask> {
    return practiceSystem.invoke<PracticeTask>("update_practice_task_admin", {
        patch: {
            id: patch.id,
            title: patch.title,
            body: patch.body,
            kind: patch.kind,
            assigneeRole: patch.assigneeRole ?? null,
            assigneeUserId: patch.assigneeUserId ?? null,
            status: patch.status,
        },
    });
}

export async function listPracticeTaskComments(taskId: string): Promise<PracticeTaskComment[]> {
    return practiceSystem.invoke<PracticeTaskComment[]>("list_practice_task_comments", {
        taskId,
    });
}

export async function addPracticeTaskComment(
    taskId: string,
    body: string,
): Promise<PracticeTaskComment> {
    return practiceSystem.invoke<PracticeTaskComment>("add_practice_task_comment", {
        args: { taskId, body },
    });
}
