import { describe, expect, it } from "vitest";
import {
    displayPaymentNote,
    displayPracticeTaskTitle,
    paymentStatusDisplay,
    stripRequirementIds,
    vorgangText,
} from "./finance-order-labels";
import { clinicalServiceLabel } from "./clinical-service-label";

const t = (key: string) => {
    const map: Record<string, string> = {
        "payment.note.auto_open_billing": "Open billing",
        "practice_task.auto_billing": "Record payment",
        "practice_task.demo_billing_follow_up": "Demo billing follow-up",
        "enum.reference.treatment": "Treatment",
        "enum.reference.examination": "Examination",
        "enum.reference.direct_payment": "Direct payment",
    };
    return map[key] ?? key;
};

describe("stripRequirementIds", () => {
    it("removes FA/NFA codes from user copy", () => {
        expect(
            stripRequirementIds(
                "Created automatically after service entry: open billing (FA-LEIST-06/07)",
            ),
        ).toBe("Created automatically after service entry: open billing");
        expect(
            stripRequirementIds("WAAD 9.5 — diagnoses from examinations"),
        ).toBe("diagnoses from examinations");
    });
});

describe("displayPaymentNote", () => {
    it("translates auto open-billing boilerplate", () => {
        expect(
            displayPaymentNote(
                "Created automatically after service entry: open billing (FA-LEIST-06/07)",
                t,
            ),
        ).toBe("Open billing");
    });
});

describe("clinicalServiceLabel", () => {
    it("translates seed catalog names in Arabic", () => {
        expect(clinicalServiceLabel("Root canal anterior", "ar")).toBe("علاج عصب للسن الأمامي");
        expect(clinicalServiceLabel("Root canal anterior", "en")).toBe("Root canal anterior");
        expect(clinicalServiceLabel("Recall / checkup", "ar")).toBe("فحص دوري / مراجعة");
        expect(clinicalServiceLabel("Recall / checkup (49.00 €)", "ar")).toBe("فحص دوري / مراجعة (49.00 €)");
        expect(clinicalServiceLabel("Zirconia crown (690.00 €)", "ar")).toBe("تاج زركونيا (690.00 €)");
        expect(clinicalServiceLabel("Record payment: Recall / checkup (49.00 €)", "ar")).toBe(
            "Record payment: فحص دوري / مراجعة (49.00 €)",
        );
        expect(clinicalServiceLabel("Wisdom tooth removal", "ar")).toBe("قلع ضرس العقل");
        expect(clinicalServiceLabel("Professional cleaning", "de")).toBe("Professionelle Zahnreinigung");
    });
});

describe("vorgangText", () => {
    it("combines kind with sanitized note", () => {
        expect(
            vorgangText(
                {
                    examination_id: "u1",
                    description: "Created automatically after service entry: open billing (FA-LEIST-06/07)",
                },
                t,
            ),
        ).toBe("Examination — Open billing");
    });
});

describe("displayPracticeTaskTitle", () => {
    it("localizes auto billing titles", () => {
        expect(displayPracticeTaskTitle("Payment erfassen: Root canal anterior", t)).toBe(
            "Record payment: Root canal anterior",
        );
        expect(displayPracticeTaskTitle("Collect payment — Root canal anterior", t)).toBe(
            "Record payment: Root canal anterior",
        );
        expect(displayPracticeTaskTitle("Demo billing follow-up", t)).toBe("Demo billing follow-up");
    });
});

describe("paymentStatusDisplay", () => {
    it("maps snake, camel, and lowercase statuses to i18n keys", () => {
        expect(paymentStatusDisplay("PAID", t).label).toBe("enum.payment_status.paid");
        expect(paymentStatusDisplay("paid", t).label).toBe("enum.payment_status.paid");
        expect(paymentStatusDisplay("partiallyPaid", t).label).toBe("enum.payment_status.partiallyPaid");
        expect(paymentStatusDisplay("OUTSTANDING", t).label).toBe("enum.payment_status.outstanding");
        expect(paymentStatusDisplay("cancelled", t).label).toBe("enum.payment_status.cancelled");
    });
});
