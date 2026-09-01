import { describe, expect, it } from "vitest";
import {
    buildCertificateTemplatePayload,
    parseCertificateTemplatePayload,
} from "@/lib/certificate-composer";

describe("parseCertificateTemplatePayload", () => {
    it("reads English payload keys", () => {
        const parsed = parseCertificateTemplatePayload(
            JSON.stringify({
                illnesses: "Cold",
                day_count: 3,
                activity_restriction: "Rest",
            }),
        );
        expect(parsed).toEqual({ illnesses: "Cold", dayCount: "3", activityRestriction: "Rest" });
    });

    it("ignores leftover German payload keys", () => {
        const parsed = parseCertificateTemplatePayload(
            JSON.stringify({
                krankheiten: "Grippe",
                tage_anzahl: 2,
                einschraenkung: "Schonung",
            }),
        );
        expect(parsed).toEqual({ illnesses: "", dayCount: "", activityRestriction: "" });
    });
});

describe("buildCertificateTemplatePayload", () => {
    it("writes English keys", () => {
        expect(
            buildCertificateTemplatePayload({
                illnesses: " Cold ",
                dayCount: "4",
                activityRestriction: " Rest ",
            }),
        ).toEqual({
            illnesses: "Cold",
            day_count: 4,
            activity_restriction: "Rest",
        });
    });
});
