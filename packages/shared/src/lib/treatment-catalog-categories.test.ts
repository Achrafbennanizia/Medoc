import { describe, expect, it } from "vitest";
import {
    treatmentCatalogCategoryLabel,
    buildTreatmentCatalogCategoryOptions,
    DEFAULT_CATALOG_CATEGORIES,
    EXAMINATION_CATALOG_CATEGORY,
} from "./treatment-catalog-categories";

const t = (key: string) => {
    const labels: Record<string, string> = {
        "enum.treatment_catalog.category.checkup": "Check-up examination",
        "enum.treatment_catalog.category.filling_therapy": "Filling therapy",
        "enum.treatment_catalog.category.periodontology": "Periodontics",
        "enum.treatment_catalog.category.surgery": "Surgery",
        "enum.treatment_catalog.category.prosthodontics": "Prosthetics",
    };
    return labels[key] ?? key;
};

describe("treatment-catalog-categories", () => {
    it("translates known default categories", () => {
        expect(treatmentCatalogCategoryLabel(t, EXAMINATION_CATALOG_CATEGORY)).toBe("Check-up examination");
        expect(treatmentCatalogCategoryLabel(t, "Surgery")).toBe("Surgery");
    });

    it("passes through custom category values", () => {
        expect(treatmentCatalogCategoryLabel(t, "Implantology")).toBe("Implantology");
    });

    it("builds sorted select options with translated labels", () => {
        const options = buildTreatmentCatalogCategoryOptions(
            t,
            [...DEFAULT_CATALOG_CATEGORIES, "Implantology"],
            "en",
        );
        expect(options.map((o) => o.label)).toEqual([
            "Check-up examination",
            "Filling therapy",
            "Implantology",
            "Periodontics",
            "Prosthetics",
            "Surgery",
        ]);
        expect(options.every((o) => o.value)).toBe(true);
    });
});
