import { describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import de from "../../locales/de.json";
import fr from "../../locales/fr.json";
import ar from "../../locales/ar.json";
import { DOCUMENT_LABEL_KEYS, docLabel } from "./document-labels";

const LOCALES = { en, de, fr, ar } as Record<string, Record<string, string>>;

describe("document legal labels", () => {
    it.each(DOCUMENT_LABEL_KEYS)("document.legal.%s exists in every locale", (k) => {
        for (const [loc, dict] of Object.entries(LOCALES)) expect(dict[`document.legal.${k}`], `${loc}`).toBeTruthy();
    });
    it("renders in the requested document language, not the key", () => {
        expect(docLabel("service", "de")).toBe("Leistung");
        expect(docLabel("service", "en")).toBe("Service");
    });
});
