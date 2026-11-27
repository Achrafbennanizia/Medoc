import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/systems/practice-host/adapters/practice-transport", () => ({
    practiceSystem: { invoke: vi.fn() },
}));

import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import { historyForPatient, historyForRecord } from "./history.controller";

/** T5.8: argument names match the Rust commands (camelCase → `entity_id`, `patient_id`). */
describe("history.controller", () => {
    beforeEach(() => {
        vi.mocked(practiceSystem.invoke).mockReset().mockResolvedValue({ items: [] });
    });

    it("asks for one record's history", async () => {
        await historyForRecord("practice_task", "t1");
        expect(vi.mocked(practiceSystem.invoke).mock.calls).toEqual([
            ["history_for_record", { table: "practice_task", entityId: "t1" }],
        ]);
    });

    it("asks for a patient's history", async () => {
        await historyForPatient("p1");
        expect(vi.mocked(practiceSystem.invoke).mock.calls).toEqual([["history_for_patient", { patientId: "p1" }]]);
    });
});
