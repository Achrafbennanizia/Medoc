import { describe, expect, it } from "vitest";
import {
    CHART_STATUS_VALUES,
    ORDER_STATUS_VALUES,
    FEEDBACK_CATEGORY_VALUES,
    FEEDBACK_STATUS_VALUES,
    SEX_VALUES,
    PATIENT_STATUS_VALUES,
    ROLE_VALUES,
    APPOINTMENT_KIND_VALUES,
    APPOINTMENT_STATUS_VALUES,
    PAYMENT_METHOD_VALUES,
    PAYMENT_STATUS_VALUES,
} from "@/models/types";
import {
    ChartStatusSchema,
    FeedbackCategorySchema,
    SexSchema,
    PatientStatusSchema,
    RoleSchema,
    AppointmentKindSchema,
    AppointmentStatusSchema,
    PaymentMethodSchema,
    PaymentStatusSchema,
} from "@/lib/schemas";

describe("canonical domain enums ↔ Zod", () => {
    it("Sex", () => {
        expect(SEX_VALUES).toEqual(["MALE", "FEMALE", "DIVERSE"]);
        for (const version of SEX_VALUES) {
            expect(SexSchema.parse(version)).toBe(version);
        }
    });

    it("Role", () => {
        expect(ROLE_VALUES).toEqual(["PHYSICIAN", "RECEPTION", "TAX_ADVISOR", "PHARMA_CONSULTANT"]);
        for (const version of ROLE_VALUES) {
            expect(RoleSchema.parse(version)).toBe(version);
        }
    });

    it("AppointmentKind (Rust / SQLite CHECK, no NOTFALL)", () => {
        expect(APPOINTMENT_KIND_VALUES).toEqual(["FIRST_VISIT", "EXAMINATION", "TREATMENT", "CHECKUP", "CONSULTATION"]);
        for (const version of APPOINTMENT_KIND_VALUES) {
            expect(AppointmentKindSchema.parse(version)).toBe(version);
        }
        expect(AppointmentKindSchema.safeParse("NOTFALL").success).toBe(false);
    });

    it("AppointmentStatus (NO_SHOW matches SQLite + Rust serde rename)", () => {
        expect(APPOINTMENT_STATUS_VALUES).toContain("NO_SHOW");
        expect(AppointmentStatusSchema.parse("NO_SHOW")).toBe("NO_SHOW");
        expect(AppointmentStatusSchema.safeParse("NICHTERSCHIENEN").success).toBe(false);
    });

    it("PatientStatus", () => {
        for (const version of PATIENT_STATUS_VALUES) {
            expect(PatientStatusSchema.parse(version)).toBe(version);
        }
    });

    it("ChartStatus", () => {
        for (const version of CHART_STATUS_VALUES) {
            expect(ChartStatusSchema.parse(version)).toBe(version);
        }
    });

    it("PaymentMethod (INVOICE not VERSICHERUNG)", () => {
        expect(PAYMENT_METHOD_VALUES).toContain("INVOICE");
        expect(PAYMENT_METHOD_VALUES).not.toContain("VERSICHERUNG" as never);
        for (const version of PAYMENT_METHOD_VALUES) {
            expect(PaymentMethodSchema.parse(version)).toBe(version);
        }
    });

    it("PaymentStatus (Rust enum order → UPPERCASE)", () => {
        expect(PAYMENT_STATUS_VALUES).toEqual(["OUTSTANDING", "PAID", "PARTIALLY_PAID", "CANCELLED"]);
        for (const version of PAYMENT_STATUS_VALUES) {
            expect(PaymentStatusSchema.parse(version)).toBe(version);
        }
    });

    it("OrderStatus constants", () => {
        expect(ORDER_STATUS_VALUES).toEqual(["OPEN", "IN_TRANSIT", "DELIVERED", "CANCELLED"]);
    });

    it("Feedback category / status", () => {
        for (const version of FEEDBACK_CATEGORY_VALUES) {
            expect(FeedbackCategorySchema.parse(version)).toBe(version);
        }
        expect(FEEDBACK_STATUS_VALUES).toEqual(["OPEN", "IN_PROGRESS", "DONE"]);
    });
});
