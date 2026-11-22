import { describe, expect, it } from "vitest";
import { timeZoneDisplayName, timeZoneOptionLabel } from "./time-zone-label";

describe("timeZoneDisplayName", () => {
    it("returns a French name for Europe/Berlin", () => {
        const name = timeZoneDisplayName("Europe/Berlin", "fr-FR");
        expect(name.toLowerCase()).toMatch(/berlin|europe|heure/);
        expect(name).not.toBe("Europe/Berlin");
    });

    it("returns a German name for Europe/Berlin", () => {
        const name = timeZoneDisplayName("Europe/Berlin", "de-DE");
        expect(name.toLowerCase()).toMatch(/berlin|europa|zeit|mitteleurop/);
        expect(name).not.toBe("Europe/Berlin");
    });

    it("returns Arabic letters for Europe/Berlin", () => {
        const name = timeZoneDisplayName("Europe/Berlin", "ar-EG");
        expect(/[\u0600-\u06FF]/.test(name)).toBe(true);
    });

    it("keeps the IANA id when localization is unavailable", () => {
        expect(timeZoneDisplayName("Not/AZone", "en-US")).toBe("Not/AZone");
    });
});

describe("timeZoneOptionLabel", () => {
    it("includes the IANA id for every locale", () => {
        for (const tag of ["en-US", "de-DE", "fr-FR", "ar-EG"]) {
            expect(timeZoneOptionLabel("Europe/Berlin", tag)).toContain("Europe/Berlin");
        }
    });
});
