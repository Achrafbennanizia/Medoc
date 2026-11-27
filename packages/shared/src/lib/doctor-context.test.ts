import { describe, expect, it } from "vitest";
import { DOCTOR_CONTEXT, MULTI_DOCTOR, SINGLE_DOCTOR } from "./doctor-context";

const docs = [{ id: "a" }, { id: "b" }];

describe("doctor context", () => {
    it("is multi-doctor in the group build used by tests", () => {
        expect(DOCTOR_CONTEXT).toBe(MULTI_DOCTOR);
    });

    it("single-doctor hides the doctor UI and fills in the physician", () => {
        expect(SINGLE_DOCTOR.showDoctorUi).toBe(false);
        expect(SINGLE_DOCTOR.defaultDoctorId(docs)).toBe("a");
        expect(SINGLE_DOCTOR.defaultDoctorId(docs, "b")).toBe("b");
        expect(SINGLE_DOCTOR.defaultDoctorId(docs, "gone")).toBe("a");
        expect(SINGLE_DOCTOR.defaultDoctorId([])).toBe("");
    });

    it("multi-doctor lets the user pick unless a known doctor is preferred", () => {
        expect(MULTI_DOCTOR.showDoctorUi).toBe(true);
        expect(MULTI_DOCTOR.defaultDoctorId(docs)).toBe("");
        expect(MULTI_DOCTOR.defaultDoctorId(docs, "b")).toBe("b");
    });
});
