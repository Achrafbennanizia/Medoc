import { describe, expect, it } from "vitest";
import type { PracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import { mergeUpdatedTask, sortTasksByFlow, taskBelongsInInbox, taskNextStatuses } from "./task-flow";
import { selectableTaskStatuses } from "./constants";

function task(id: string, status: PracticeTask["status"], updated: string): PracticeTask {
    return {
        id, status, updated_at: updated, created_at: "2026-11-01 08:00:00", patient_id: null, kind: "OTHER", title: id, body: null,
        assignee_role: "RECEPTION", assignee_user_id: null, created_by: "u1", treatment_id: null, examination_id: null,
        service_name: null, total_cost: null, payment_id: null, done_note: null, return_reason: null, legacy_ticket_id: null,
    };
}

describe("task flow", () => {
    it("orders by phase, then most recent activity", () => {
        const list = sortTasksByFlow([
            task("done", "VALIDATED", "2026-11-20 10:00:00"),
            task("review", "DONE_RECEPTION", "2026-11-20 09:00:00"),
            task("open-old", "OPEN", "2026-11-18 09:00:00"),
            task("open-new", "OPEN", "2026-11-20 09:00:00"),
            task("back", "BACK", "2026-11-10 09:00:00"),
        ]);
        expect(list.map((t) => t.id)).toEqual(["back", "open-new", "open-old", "review", "done"]);
    });

    it("re-ranks a task immediately when it is completed (no longer stuck on top)", () => {
        const before = sortTasksByFlow([task("a", "OPEN", "2026-11-20 10:00:00"), task("b", "IN_PROGRESS", "2026-11-20 09:00:00")]);
        expect(before[0]!.id).toBe("a");
        const after = mergeUpdatedTask(before, task("a", "DONE_RECEPTION", "2026-11-20 11:00:00"));
        expect(after.map((t) => t.id)).toEqual(["b", "a"]);
        const inbox = mergeUpdatedTask(after, task("a", "VALIDATED", "2026-11-20 12:00:00"), taskBelongsInInbox);
        expect(inbox.map((t) => t.id)).toEqual(["b"]);
    });

    it("offers fulfillers only backend-allowed next steps", () => {
        expect(taskNextStatuses("OPEN")).toEqual(["OPEN", "IN_PROGRESS"]);
        const opts = selectableTaskStatuses({ current: "OPEN", canAdminStatus: false, canFulfillStatus: true }).map((o) => o.value);
        expect(opts).toEqual(["OPEN", "IN_PROGRESS"]);
    });
});
