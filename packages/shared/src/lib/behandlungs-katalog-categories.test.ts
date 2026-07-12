import { describe, expect, it } from "vitest";
import {
    behandlungsKatalogCategoryLabel,
    buildBehandlungsKatalogCategoryOptions,
    DEFAULT_CATALOG_CATEGORIES,
    EXAMINATION_CATALOG_CATEGORY,
} from "./behandlungs-katalog-categories";

const t = (key: string) => {
    const labels: Record<string, string> = {
        "enum.behandlungs_katalog.kategorie.kontrolluntersuchung": "Check-up examination",
        "enum.behandlungs_katalog.kategorie.fuellungstherapie": "Filling therapy",
        "enum.behandlungs_katalog.kategorie.parodontologie": "Periodontics",
        "enum.behandlungs_katalog.kategorie.chirurgie": "Surgery",
        "enum.behandlungs_katalog.kategorie.prothetik": "Prosthetics",
    };
    return labels[key] ?? key;
};

describe("behandlungs-katalog-categories", () => {
    it("translates known default categories", () => {
        expect(behandlungsKatalogCategoryLabel(t, EXAMINATION_CATALOG_CATEGORY)).toBe("Check-up examination");
        expect(behandlungsKatalogCategoryLabel(t, "Chirurgie")).toBe("Surgery");
    });

    it("passes through custom category values", () => {
        expect(behandlungsKatalogCategoryLabel(t, "Implantologie")).toBe("Implantologie");
    });

    it("builds sorted select options with translated labels", () => {
        const options = buildBehandlungsKatalogCategoryOptions(
            t,
            [...DEFAULT_CATALOG_CATEGORIES, "Implantologie"],
            "en",
        );
        expect(options.map((o) => o.label)).toEqual([
            "Check-up examination",
            "Filling therapy",
            "Implantologie",
            "Periodontics",
            "Prosthetics",
            "Surgery",
        ]);
        expect(options.every((o) => o.value)).toBe(true);
    });
});
