/** Shared fixtures for critical-flows smoke suites (no App import — keep graphs small). */
import type { Session, Payment } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import { vi } from "vitest";
import { cleanup } from "@testing-library/react";

export const PHYSICIAN_SESSION: Session = {
    user_id: "u-smoke",
    name: "Dr. Smoke",
    email: "smoke@medoc.test",
    role: "PHYSICIAN",
};

export const MOCK_PATIENT = {
    id: "p-smoke-1",
    name: "Patient Smoke",
    date_of_birth: "1988-01-15",
    sex: "MALE" as const,
    insurance_number: "VNR-SMOKE-1",
    phone: null,
    email: null,
    address: null,
    status: "ACTIVE" as const,
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
};

export const MOCK_CHART = {
    id: "chart-smoke-1",
    patient_id: MOCK_PATIENT.id,
    status: "VALIDATED" as const,
    diagnosis: null,
    findings: null,
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
};

export const MOCK_DENTAL_FINDING = {
    id: "zb-smoke-1",
    chart_id: MOCK_CHART.id,
    tooth_number: 11,
    finding: "KARIES",
    diagnosis: null,
    notes: null,
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
};

export function resetAuthStore() {
    useAuthStore.setState({ session: null, sessionChecked: false });
}

export function installCriticalFlowCleanup() {
    return () => {
        cleanup();
        resetAuthStore();
        vi.clearAllMocks();
    };
}
