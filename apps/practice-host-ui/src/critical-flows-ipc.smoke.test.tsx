/** @vitest-environment jsdom */
/** IPC-only critical flows — no full App mount. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPatient } from "@/systems/practice-host/controllers/patient.controller";
import { getChart, createDentalFinding } from "@/systems/practice-host/controllers/chart.controller";
import { setChartSectionValidated } from "@/systems/practice-host/controllers/validation.controller";
import { createAppointment, updateAppointment } from "@/systems/practice-host/controllers/appointment.controller";
import { createPayment, updatePaymentStatus } from "@/systems/practice-host/controllers/payment.controller";
import type { Payment } from "@/models/types";
import { tauriInvoke } from "@/services/tauri.service";
import {
    MOCK_PATIENT,
    MOCK_CHART,
    MOCK_DENTAL_FINDING,
    installCriticalFlowCleanup,
} from "./critical-flows.smoke.shared";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
}));

afterEach(installCriticalFlowCleanup());

describe("critical flow (b) patient → chart → DentalFinding → validate Master", () => {
    const calls: string[] = [];

    beforeEach(() => {
        calls.length = 0;
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
            calls.push(cmd);
            if (cmd === "create_patient") return MOCK_PATIENT;
            if (cmd === "get_chart") return MOCK_CHART;
            if (cmd === "update_dental_finding") return MOCK_DENTAL_FINDING;
            if (cmd === "set_chart_section_validated") return undefined;
            throw new Error(`unmocked IPC in flow (b): ${cmd} ${JSON.stringify(args)}`);
        });
    });

    it("performs the IPC sequence for.stub backend", async () => {
        const p = await createPatient({
            name: MOCK_PATIENT.name,
            date_of_birth: MOCK_PATIENT.date_of_birth,
            sex: MOCK_PATIENT.sex,
            insurance_number: MOCK_PATIENT.insurance_number,
        });
        expect(p.id).toBe(MOCK_PATIENT.id);

        const chart = await getChart(p.id);
        expect(chart.id).toBe(MOCK_CHART.id);

        const zb = await createDentalFinding({
            chart_id: chart.id,
            tooth_number: 11,
            finding: "KARIES",
        });
        expect(zb.tooth_number).toBe(11);

        await setChartSectionValidated(p.id, "master", "u-smoke");

        expect(calls).toEqual([
            "create_patient",
            "get_chart",
            "update_dental_finding",
            "set_chart_section_validated",
        ]);
    });
});

describe("critical flow (c) appointment → completed → payment → paid", () => {
    const calls: string[] = [];

    const appointment1 = {
        id: "t-smoke-1",
        date: "2026-05-10",
        time: "09:30:00",
        kind: "EXAMINATION" as const,
        status: "PLANNED" as const,
        notes: null,
        chief_complaint: null,
        patient_id: MOCK_PATIENT.id,
        physician_id: "u-smoke",
        created_at: "2026-05-01 08:00:00",
        updated_at: "2026-05-01 08:00:00",
    };

    const payment1: Payment = {
        id: "z-smoke-1",
        patient_id: MOCK_PATIENT.id,
        amount: 42,
        payment_method: "CASH",
        status: "OUTSTANDING",
        service_item_id: null,
        description: null,
        created_at: "2026-05-10 10:00:00",
    };

    beforeEach(() => {
        calls.length = 0;
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
            calls.push(cmd);
            if (cmd === "create_appointment") return appointment1;
            if (cmd === "update_appointment") return { ...appointment1, status: "COMPLETED" as const };
            if (cmd === "create_payment") return payment1;
            if (cmd === "update_payment_status") return { ...payment1, status: "PAID" as const };
            throw new Error(`unmocked IPC in flow (c): ${cmd}`);
        });
    });

    it("advances appointment and settles payment in IPC order", async () => {
        const t0 = await createAppointment({
            date: appointment1.date,
            time: appointment1.time,
            kind: appointment1.kind,
            patient_id: appointment1.patient_id,
            physician_id: appointment1.physician_id,
        });
        expect(t0.status).toBe("PLANNED");

        const t1 = await updateAppointment(t0.id, { status: "COMPLETED" });
        expect(t1.status).toBe("COMPLETED");

        const z = await createPayment({
            patient_id: MOCK_PATIENT.id,
            amount: 42,
            payment_method: "CASH",
        });
        expect(z.status).toBe("OUTSTANDING");

        const zDone = await updatePaymentStatus(z.id, "PAID");
        expect(zDone.status).toBe("PAID");

        expect(calls).toEqual([
            "create_appointment",
            "update_appointment",
            "create_payment",
            "update_payment_status",
        ]);
    });
});
