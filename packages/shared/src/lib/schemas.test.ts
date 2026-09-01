import { describe, expect, it } from "vitest";
import {
    CreatePatientSchema,
    CreateAppointmentSchema,
    CreatePurchaseOrderSchema,
    CreateFeedbackSchema,
    zodErrorToMessage,
} from "./schemas";

describe("CreatePatientSchema", () => {
    it("accepts a minimal valid payload", () => {
        const out = CreatePatientSchema.parse({
            name: "Max Sample",
            date_of_birth: "1970-01-01",
            sex: "MALE",
            insurance_number: "A123456789",
        });
        expect(out.name).toBe("Max Sample");
        expect(out.email).toBeNull();
    });

    it("rejects malformed birthdate", () => {
        const r = CreatePatientSchema.safeParse({
            name: "X",
            date_of_birth: "01.01.1970",
            sex: "MALE",
            insurance_number: "A123",
        });
        expect(r.success).toBe(false);
    });

    it("treats empty email as null (not invalid)", () => {
        const out = CreatePatientSchema.parse({
            name: "X",
            date_of_birth: "1970-01-01",
            sex: "FEMALE",
            insurance_number: "A1",
            email: "",
        });
        expect(out.email).toBeNull();
    });
});

describe("CreateAppointmentSchema", () => {
    it("accepts ISO date + HH:MM time", () => {
        const out = CreateAppointmentSchema.parse({
            date: "2026-04-25",
            time: "09:30",
            kind: "CHECKUP",
            patient_id: "pat-1",
            physician_id: "physician-1",
        });
        expect(out.time).toBe("09:30");
    });

    it("rejects unknown Appointment-Art", () => {
        expect(() =>
            CreateAppointmentSchema.parse({
                date: "2026-04-25",
                time: "09:30",
                kind: "WURSTBROT",
                patient_id: "pat-1",
                physician_id: "physician-1",
            }),
        ).toThrow();
    });
});

describe("CreatePurchaseOrderSchema", () => {
    it("requires positive integer quantity", () => {
        expect(() =>
            CreatePurchaseOrderSchema.parse({ supplier: "ACME", item: "X", quantity: 0 }),
        ).toThrow();
    });

    it("treats empty expected_on as null", () => {
        const out = CreatePurchaseOrderSchema.parse({
            supplier: "ACME",
            item: "X",
            quantity: 5,
            expected_on: "",
        });
        expect(out.expected_on).toBeNull();
    });
});

describe("CreateFeedbackSchema", () => {
    it("rejects too short subject", () => {
        expect(() =>
            CreateFeedbackSchema.parse({
                category: "feedback",
                subject: "Hi",
                message: "Eine ausreichend lange Nachricht.",
            }),
        ).toThrow();
    });
});

describe("parseOrThrow / zodErrorToMessage", () => {
    it("throws Error combining all Zod issues with semicolon", () => {
        const r = CreatePatientSchema.safeParse({
            name: "",
            date_of_birth: "bad",
            sex: "MALE",
            insurance_number: "x",
        });
        expect(r.success).toBe(false);
        if (r.success) throw new Error("expected failure");
        const msg = zodErrorToMessage(r.error);
        expect(msg).toContain(";");
        expect(msg.length).toBeGreaterThan(10);
    });

    it("falls through non-zod errors verbatim", () => {
        expect(zodErrorToMessage(new Error("boom"))).toBe("boom");
    });
});
