/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { patientDetailTabBlocked } from "@/lib/patient-detail-utils";
import { PatientDetailAkteSubnav } from "./patient-detail-akte-subnav";

const baseProps = {
    activeTab: "stamm" as const,
    validation: { stamm: true, anam: true, unter: true, behand: true, rezept: true, anlage: true, zahl: true },
    anlagen: [],
    zahlungen: [],
    itemValidation: {},
    onSelectTab: vi.fn(),
    onBlockedClinicalTab: vi.fn(),
};

describe("PatientDetailAkteSubnav smoke (G21 rows 5–6 proxy)", () => {
    afterEach(() => cleanup());

    it("REZEPTION: clinical tabs disabled, Kundenleistungen reachable", () => {
        const onSelect = vi.fn();

        render(
            <PatientDetailAkteSubnav
                {...baseProps}
                canViewClinical={false}
                onSelectTab={onSelect}
                onBlockedClinicalTab={vi.fn()}
            />,
        );

        const anam = document.getElementById("tab-anam") as HTMLButtonElement;
        const zahl = document.getElementById("tab-zahl") as HTMLButtonElement;

        expect(anam.disabled).toBe(true);
        expect(zahl.disabled).toBe(false);
        expect(patientDetailTabBlocked("anam", false)).toBe(true);
        expect(patientDetailTabBlocked("zahl", false)).toBe(false);

        fireEvent.click(zahl);
        expect(onSelect).toHaveBeenCalledWith("zahl");
    });

    it("ARZT: clinical tabs enabled in subnav", () => {
        render(<PatientDetailAkteSubnav {...baseProps} canViewClinical={true} />);

        expect(document.getElementById("tab-anam")!.disabled).toBe(false);
        expect(document.getElementById("tab-unter")!.disabled).toBe(false);
        expect(patientDetailTabBlocked("anam", true)).toBe(false);
    });
});
