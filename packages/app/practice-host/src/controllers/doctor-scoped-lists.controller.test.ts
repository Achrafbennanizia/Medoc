import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/systems/practice-host/adapters/practice-transport", () => ({
    practiceSystem: { invoke: vi.fn() },
}));

import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import { listPurchaseOrders } from "./purchase-order.controller";
import { listPracticeTasksAdmin } from "./practice-task.controller";

/** T5.4: the list commands take an optional doctorId (camelCase → Tauri `doctor_id`). */
describe("doctor-scoped list controllers", () => {
    const calls = () => vi.mocked(practiceSystem.invoke).mock.calls;
    beforeEach(() => {
        vi.mocked(practiceSystem.invoke).mockReset().mockResolvedValue({ items: [] });
    });

    it("sends null without a doctor and the id with one", async () => {
        await listPurchaseOrders();
        await listPurchaseOrders("dr-a");
        await listPracticeTasksAdmin();
        await listPracticeTasksAdmin("dr-b");
        expect(calls()).toEqual([
            ["list_purchase_orders", { doctorId: null }],
            ["list_purchase_orders", { doctorId: "dr-a" }],
            ["list_practice_tasks_admin", { doctorId: null }],
            ["list_practice_tasks_admin", { doctorId: "dr-b" }],
        ]);
    });

    it("treats an empty filter as no filter", async () => {
        await listPurchaseOrders("");
        expect(calls()).toEqual([["list_purchase_orders", { doctorId: null }]]);
    });
});
