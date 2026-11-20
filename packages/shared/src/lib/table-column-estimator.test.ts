import { describe, expect, it } from "vitest";
import {
    columnContentWeightPx,
    distributeColumnWidthsPx,
    estimateColumnWidthPx,
} from "./table-column-estimator";

describe("table-column-estimator", () => {
    it("weights columns by average content floored by header", () => {
        expect(
            columnContentWeightPx({
                headerPx: 40,
                cellWidthsPx: [20, 30, 40],
            }),
        ).toBe(40 + 28);
        expect(
            columnContentWeightPx({
                headerPx: 10,
                cellWidthsPx: [100, 100, 100],
            }),
        ).toBe(100 + 28);
    });

    it("distributes available width so columns sum to the container", () => {
        const widths = distributeColumnWidthsPx(
            [
                { headerPx: 100, cellWidthsPx: [100] },
                { headerPx: 50, cellWidthsPx: [50] },
            ],
            300,
            { paddingPx: 0, minPx: 40 },
        );
        expect(widths).toHaveLength(2);
        expect(widths.reduce((a, b) => a + b, 0)).toBe(300);
        // 100:50 → 2:1 of 300
        expect(widths[0]).toBe(200);
        expect(widths[1]).toBe(100);
    });

    it("fills full width even when content weights are tiny", () => {
        const widths = distributeColumnWidthsPx(
            [
                { headerPx: 10, cellWidthsPx: [] },
                { headerPx: 10, cellWidthsPx: [] },
                { headerPx: 10, cellWidthsPx: [] },
            ],
            600,
            { paddingPx: 0, minPx: 48 },
        );
        expect(widths.reduce((a, b) => a + b, 0)).toBe(600);
        expect(widths.every((w) => w >= 48)).toBe(true);
    });

    it("estimateColumnWidthPx still clamps for legacy callers", () => {
        expect(
            estimateColumnWidthPx(
                { headerPx: 500, cellWidthsPx: [600] },
                { minPx: 48, maxPx: 200, paddingPx: 0 },
            ),
        ).toBe(200);
    });
});
