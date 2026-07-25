import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import { normalizeWorkflowRoute, tauriInvoke } from "./tauri.service";

describe("tauri.service workflow bridge helpers", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("normalizes dynamic route segments for workflow logs", () => {
        expect(normalizeWorkflowRoute("/")).toBe("/");
        expect(
            normalizeWorkflowRoute(
                "/patienten/123/rezept/550e8400-e29b-41d4-a716-446655440000/abcdefghijklmnop"
            ),
        ).toBe("/patienten/:num/rezept/:uuid/:id");
    });

    it("keeps invoke arg dual-case expansion for tauri commands", async () => {
        invokeMock.mockResolvedValueOnce({ ok: true });

        await tauriInvoke("create_patient", {
            patient_id: "pat-1",
            patientName: "Anna",
            optional: undefined,
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("create_patient", {
            patient_id: "pat-1",
            patientId: "pat-1",
            patientName: "Anna",
            patient_name: "Anna",
        });
    });
});
