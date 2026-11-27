import "../../../../../../packages/ui/src/install-dom.test-helper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

vi.mock("@/systems/practice-host/controllers/history.controller", () => ({
    historyForPatient: vi.fn(),
    historyForRecord: vi.fn(),
}));

import { historyForPatient } from "@/systems/practice-host/controllers/history.controller";
import { PatientHistoryPanel } from "./record-history";

describe("Patient History panel", () => {
    afterEach(cleanup);
    beforeEach(() => vi.mocked(historyForPatient).mockReset());

    it("shows who changed what, on which device, old → new, and doctors not shared", async () => {
        vi.mocked(historyForPatient).mockResolvedValue({
            items: [
                {
                    id: "h2",
                    table: "appointment",
                    entityId: "a1",
                    op: "UPDATE",
                    actorStaffId: "dr-a",
                    actorName: "Dr. Alaoui",
                    deviceId: "dev-reception-1",
                    deviceLabel: "Reception PC",
                    at: "2026-11-27T10:00:00Z",
                    changes: [{ field: "time", old: "10:00", new: "11:30" }],
                },
                {
                    id: "h1",
                    table: "patient",
                    entityId: "p1",
                    op: "INSERT",
                    actorStaffId: "system",
                    deviceId: "dev-main",
                    at: "2026-11-26T09:00:00Z",
                    changes: [{ field: "name", old: null, new: "Salma" }],
                },
            ],
            hiddenDoctors: ["Dr. Bennani"],
        });
        const { container, getByRole } = render(<PatientHistoryPanel patientId="p1" />);
        await waitFor(() => expect(container.querySelectorAll(".record-history__item")).toHaveLength(2));
        const text = container.textContent ?? "";
        expect(text).toContain("Dr. Alaoui");
        expect(text).toContain("Reception PC");
        expect(text).toContain("10:00");
        expect(text).toContain("11:30");
        expect(text).toContain("System");
        expect(container.querySelector(".record-history__old")?.textContent).toBe("10:00");
        expect(getByRole("status").textContent).toContain("Dr. Bennani");
        expect(historyForPatient).toHaveBeenCalledWith("p1");
    });

    it("offers a retry when loading fails", async () => {
        vi.mocked(historyForPatient).mockRejectedValue(new Error("error.app.network"));
        const { getByRole } = render(<PatientHistoryPanel patientId="p1" />);
        await waitFor(() => expect(getByRole("alert")).toBeTruthy());
        vi.mocked(historyForPatient).mockResolvedValue({ items: [] });
        getByRole("button").click();
        await waitFor(() => expect(historyForPatient).toHaveBeenCalledTimes(2));
    });
});
