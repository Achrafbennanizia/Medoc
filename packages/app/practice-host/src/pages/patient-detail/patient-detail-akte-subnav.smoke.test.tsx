/** @vitest-environment jsdom */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { patientDetailTabBlocked, patientDetailTabVisible } from "@/lib/patient-detail-utils";
import { PatientDetailAkteSubnav } from "./patient-detail-akte-subnav";

const baseProps = {
    activeTab: "stamm" as const,
    validation: { stamm: true, anam: true, unter: true, behand: true, rezept: true, anlage: true, zahl: true },
    anlagen: [],
    zahlungen: [],
    itemValidation: {},
    onSelectTab: vi.fn(),
};

describe("PatientDetailAkteSubnav smoke (G21 rows 5–6 proxy)", () => {
    afterEach(() => cleanup());

    it("REZEPTION: clinical tabs hidden, Kundenleistungen reachable", () => {
        const onSelect = vi.fn();

        render(
            <PatientDetailAkteSubnav
                {...baseProps}
                canViewClinical={false}
                onSelectTab={onSelect}
            />,
        );

        expect(document.getElementById("tab-anam")).toBeNull();
        expect(document.getElementById("tab-unter")).toBeNull();
        expect(document.getElementById("tab-behand")).toBeNull();
        expect(patientDetailTabBlocked("anam", false)).toBe(true);
        expect(patientDetailTabVisible("anam", false)).toBe(false);
        expect(patientDetailTabVisible("zahl", false)).toBe(true);

        const zahl = document.getElementById("tab-zahl") as HTMLButtonElement;
        expect(zahl).toBeTruthy();
        expect(zahl.disabled).toBe(false);

        fireEvent.click(zahl);
        expect(onSelect).toHaveBeenCalledWith("zahl");
    });

    it("ARZT: clinical tabs visible in subnav", () => {
        render(<PatientDetailAkteSubnav {...baseProps} canViewClinical={true} />);

        expect(document.getElementById("tab-anam")).toBeTruthy();
        expect(document.getElementById("tab-unter")).toBeTruthy();
        expect(document.getElementById("tab-behand")).toBeTruthy();
        expect(patientDetailTabBlocked("anam", true)).toBe(false);
    });
});
