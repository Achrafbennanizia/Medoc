import "../../../../../../packages/ui/src/install-dom.test-helper";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { DENTAL_LOWER_L, DENTAL_LOWER_R, DENTAL_UPPER_L, DENTAL_UPPER_R } from "@/lib/dental";
import { HelpToothChart } from "./help-tooth-chart";

/** Drawing order of the arch: upper row right→left, then lower row. */
const ORDER = [...DENTAL_UPPER_R, ...DENTAL_UPPER_L, ...DENTAL_LOWER_R, ...DENTAL_LOWER_L];

/** The `<g>` of one tooth in the practice chart. */
function tooth(container: HTMLElement, fdi: string): Element {
    const all = container.querySelectorAll(".dental-arch__svg g.dental-arch__tooth");
    expect(all).toHaveLength(32);
    return all[ORDER.indexOf(fdi)]!;
}

describe("Help → tooth chart", () => {
    afterEach(cleanup);

    it("draws the practice chart with the examination chart and its combinations", () => {
        const { container } = render(<HelpToothChart query="" />);
        expect(tooth(container, "16").classList).toContain("is-crown");
        expect(tooth(container, "16").classList).toContain("is-caries");
        expect(tooth(container, "46").classList).toContain("is-missing");
        expect(tooth(container, "46").classList).toContain("is-implant");
        // Legend icons use the same tooth drawing: 8 statuses + 16 pairs + the motion tooth.
        expect(container.querySelectorAll("svg.dental-arch__icon")).toHaveLength(8 + 16 + 1);
    });

    it("applies the chart rules on click and can start again", () => {
        const { container, getByRole } = render(<HelpToothChart query="" />);
        // Missing on a filled tooth removes the filling (no tooth to carry it).
        fireEvent.click(getByRole("button", { name: "Missing" }));
        fireEvent.click(tooth(container, "26"));
        expect([...tooth(container, "26").classList]).toEqual(expect.arrayContaining(["is-missing"]));
        expect(tooth(container, "26").classList).not.toContain("is-filling");
        // Planned stacks on the gap.
        fireEvent.click(getByRole("button", { name: "Planned" }));
        fireEvent.click(tooth(container, "26"));
        expect(tooth(container, "26").classList).toContain("is-planned");
        expect(tooth(container, "26").classList).toContain("is-missing");

        fireEvent.click(getByRole("button", { name: "Start again" }));
        expect(tooth(container, "26").classList).toContain("is-filling");
        expect(tooth(container, "26").classList).not.toContain("is-missing");
    });

    it("search narrows to matching combinations", () => {
        const { container } = render(<HelpToothChart query="implant" />);
        const titles = [...container.querySelectorAll(".help-tooth-row strong")].map((s) => s.textContent);
        expect(titles.length).toBeGreaterThan(0);
        expect(titles.every((t) => /implant/i.test(t ?? ""))).toBe(true);
    });
});
