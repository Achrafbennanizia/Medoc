/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { patientDetailTabBlocked, patientDetailTabVisible } from "@/lib/patient-detail-utils";
import { PatientDetailChartSubnav } from "./patient-detail-chart-subnav";

const baseProps = {
    activeTab: "anamnesis" as const,
    validation: { master: true, anam: true, unter: true, treatment: true, prescription: true, attachment: true, payment: true },
    attachments: [],
    payments: [],
    itemValidation: {},
    onSelectTab: vi.fn(),
};

describe("PatientDetailChartSubnav smoke (G21 rows 5–6 proxy)", () => {
    afterEach(() => cleanup());

    it("RECEPTION: clinical tabs hidden, Kundenleistungen reachable", () => {
        const onSelect = vi.fn();

        render(
            <PatientDetailChartSubnav
                {...baseProps}
                canViewClinical={false}
                onSelectTab={onSelect}
            />,
        );

        expect(document.getElementById("tab-anam")).toBeNull();
        expect(document.getElementById("tab-unter")).toBeNull();
        expect(document.getElementById("tab-treatment")).toBeNull();
        expect(patientDetailTabBlocked("anamnesis", false)).toBe(true);
        expect(patientDetailTabVisible("anamnesis", false)).toBe(false);
        expect(patientDetailTabVisible("payment", false)).toBe(true);

        const payment = document.getElementById("tab-payment") as HTMLButtonElement;
        expect(payment).toBeTruthy();
        expect(payment.disabled).toBe(false);

        fireEvent.click(payment);
        expect(onSelect).toHaveBeenCalledWith("payment");
    });

    it("PHYSICIAN: clinical tabs visible in subnav", () => {
        render(<PatientDetailChartSubnav {...baseProps} canViewClinical={true} />);

        expect(document.getElementById("tab-anam")).toBeTruthy();
        expect(document.getElementById("tab-unter")).toBeTruthy();
        expect(document.getElementById("tab-treatment")).toBeTruthy();
        expect(patientDetailTabBlocked("anamnesis", true)).toBe(false);
    });
});
