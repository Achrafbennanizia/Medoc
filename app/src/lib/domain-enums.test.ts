import { describe, expect, it } from "vitest";
import {
    AKTEN_STATUS_VALUES,
    BESTELL_STATUS_VALUES,
    FEEDBACK_KATEGORIE_VALUES,
    FEEDBACK_STATUS_VALUES,
    GESCHLECHT_VALUES,
    PATIENT_STATUS_VALUES,
    ROLLE_VALUES,
    TERMIN_ART_VALUES,
    TERMIN_STATUS_VALUES,
    ZAHLUNGS_ART_VALUES,
    ZAHLUNGS_STATUS_VALUES,
} from "@/models/types";
import {
    AktenStatusSchema,
    FeedbackKategorieSchema,
    GeschlechtSchema,
    PatientStatusSchema,
    RolleSchema,
    TerminArtSchema,
    TerminStatusSchema,
    ZahlungsartSchema,
    ZahlungStatusSchema,
} from "@/lib/schemas";

describe("canonical domain enums ↔ Zod", () => {
    it("Geschlecht", () => {
        expect(GESCHLECHT_VALUES).toEqual(["MAENNLICH", "WEIBLICH", "DIVERS"]);
        for (const v of GESCHLECHT_VALUES) {
            expect(GeschlechtSchema.parse(v)).toBe(v);
        }
    });

    it("Rolle", () => {
        expect(ROLLE_VALUES).toEqual(["ARZT", "REZEPTION", "STEUERBERATER", "PHARMABERATER"]);
        for (const v of ROLLE_VALUES) {
            expect(RolleSchema.parse(v)).toBe(v);
        }
    });

    it("TerminArt (Rust / SQLite CHECK, no NOTFALL)", () => {
        expect(TERMIN_ART_VALUES).toEqual(["ERSTBESUCH", "UNTERSUCHUNG", "BEHANDLUNG", "KONTROLLE", "BERATUNG"]);
        for (const v of TERMIN_ART_VALUES) {
            expect(TerminArtSchema.parse(v)).toBe(v);
        }
        expect(TerminArtSchema.safeParse("NOTFALL").success).toBe(false);
    });

    it("TerminStatus (NICHT_ERSCHIENEN matches SQLite + Rust serde rename)", () => {
        expect(TERMIN_STATUS_VALUES).toContain("NICHT_ERSCHIENEN");
        expect(TerminStatusSchema.parse("NICHT_ERSCHIENEN")).toBe("NICHT_ERSCHIENEN");
        expect(TerminStatusSchema.safeParse("NICHTERSCHIENEN").success).toBe(false);
    });

    it("PatientStatus", () => {
        for (const v of PATIENT_STATUS_VALUES) {
            expect(PatientStatusSchema.parse(v)).toBe(v);
        }
    });

    it("AktenStatus", () => {
        for (const v of AKTEN_STATUS_VALUES) {
            expect(AktenStatusSchema.parse(v)).toBe(v);
        }
    });

    it("ZahlungsArt (RECHNUNG not VERSICHERUNG)", () => {
        expect(ZAHLUNGS_ART_VALUES).toContain("RECHNUNG");
        expect(ZAHLUNGS_ART_VALUES).not.toContain("VERSICHERUNG" as never);
        for (const v of ZAHLUNGS_ART_VALUES) {
            expect(ZahlungsartSchema.parse(v)).toBe(v);
        }
    });

    it("ZahlungsStatus (Rust enum order → UPPERCASE)", () => {
        expect(ZAHLUNGS_STATUS_VALUES).toEqual(["AUSSTEHEND", "BEZAHLT", "TEILBEZAHLT", "STORNIERT"]);
        for (const v of ZAHLUNGS_STATUS_VALUES) {
            expect(ZahlungStatusSchema.parse(v)).toBe(v);
        }
    });

    it("BestellStatus constants", () => {
        expect(BESTELL_STATUS_VALUES).toEqual(["OFFEN", "UNTERWEGS", "GELIEFERT", "STORNIERT"]);
    });

    it("Feedback kategorie / status", () => {
        for (const v of FEEDBACK_KATEGORIE_VALUES) {
            expect(FeedbackKategorieSchema.parse(v)).toBe(v);
        }
        expect(FEEDBACK_STATUS_VALUES).toEqual(["OFFEN", "BEARBEITUNG", "ERLEDIGT"]);
    });
});
