import { describe, expect, it } from "vitest";
import {
    filterReceptionPendingTasks,
    isReceptionActionableTaskStatus,
} from "./practice-task-actionable";

describe("practice-task-actionable", () => {
    it("recognizes reception-actionable statuses", () => {
        expect(isReceptionActionableTaskStatus("OPEN")).toBe(true);
        expect(isReceptionActionableTaskStatus("IN_PROGRESS")).toBe(true);
        expect(isReceptionActionableTaskStatus("BACK")).toBe(true);
        expect(isReceptionActionableTaskStatus("VIEWED")).toBe(true);
        expect(isReceptionActionableTaskStatus("DONE_RECEPTION")).toBe(false);
        expect(isReceptionActionableTaskStatus("VALIDATED")).toBe(false);
        expect(isReceptionActionableTaskStatus("DONE")).toBe(false);
    });

    it("drops completed and validated tasks from the pending list", () => {
        const rows = filterReceptionPendingTasks([
            { id: "1", status: "OPEN" },
            { id: "2", status: "DONE_RECEPTION" },
            { id: "3", status: "VALIDATED" },
            { id: "4", status: "BACK" },
            { id: "5", status: "IN_PROGRESS" },
            { id: "6", status: "VIEWED" },
            { id: "7", status: "DONE" },
        ]);
        expect(rows.map((r) => r.id)).toEqual(["1", "4", "5", "6"]);
    });
});
