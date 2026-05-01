import { describe, expect, it } from "vitest";
import {
    CreatePatientSchema,
    CreateTerminSchema,
    CreateBestellungSchema,
    CreateFeedbackSchema,
    parseOrThrow,
    zodErrorToMessage,
} from "./schemas";

describe("CreatePatientSchema", () => {
    it("accepts a minimal valid payload", () => {
        const out = CreatePatientSchema.parse({
            name: "Max Mustermann",
            geburtsdatum: "1970-01-01",
            geschlecht: "MAENNLICH",
            versicherungsnummer: "A123456789",
        });
        expect(out.name).toBe("Max Mustermann");
        expect(out.email).toBeNull();
    });

    it("rejects malformed birthdate", () => {
        const r = CreatePatientSchema.safeParse({
            name: "X",
            geburtsdatum: "01.01.1970",
            geschlecht: "MAENNLICH",
            versicherungsnummer: "A123",
        });
        expect(r.success).toBe(false);
    });

    it("treats empty email as null (not invalid)", () => {
        const out = CreatePatientSchema.parse({
            name: "X",
            geburtsdatum: "1970-01-01",
            geschlecht: "WEIBLICH",
            versicherungsnummer: "A1",
            email: "",
        });
        expect(out.email).toBeNull();
    });
});

describe("CreateTerminSchema", () => {
    it("accepts ISO date + HH:MM time", () => {
        const out = CreateTerminSchema.parse({
            datum: "2026-04-25",
            uhrzeit: "09:30",
            art: "ROUTINE",
            patient_id: "pat-1",
            arzt_id: "arzt-1",
        });
        expect(out.uhrzeit).toBe("09:30");
    });

    it("rejects unknown Termin-Art", () => {
        expect(() =>
            CreateTerminSchema.parse({
                datum: "2026-04-25",
                uhrzeit: "09:30",
                art: "WURSTBROT",
                patient_id: "pat-1",
                arzt_id: "arzt-1",
            }),
        ).toThrow();
    });
});

describe("CreateBestellungSchema", () => {
    it("requires positive integer menge", () => {
        expect(() =>
            CreateBestellungSchema.parse({ lieferant: "ACME", artikel: "X", menge: 0 }),
        ).toThrow();
    });

    it("treats empty erwartet_am as null", () => {
        const out = CreateBestellungSchema.parse({
            lieferant: "ACME",
            artikel: "X",
            menge: 5,
            erwartet_am: "",
        });
        expect(out.erwartet_am).toBeNull();
    });
});

describe("CreateFeedbackSchema", () => {
    it("rejects too short subject", () => {
        expect(() =>
            CreateFeedbackSchema.parse({
                kategorie: "feedback",
                betreff: "Hi",
                nachricht: "Eine ausreichend lange Nachricht.",
            }),
        ).toThrow();
    });
});

describe("parseOrThrow / zodErrorToMessage", () => {
    it("throws Error with first issue message", () => {
        try {
            parseOrThrow(CreatePatientSchema, {
                name: "",
                geburtsdatum: "bad",
                geschlecht: "MAENNLICH",
                versicherungsnummer: "x",
            });
            expect.fail("should have thrown");
        } catch (e) {
            expect((e as Error).message).toMatch(/name/i);
        }
    });

    it("falls through non-zod errors verbatim", () => {
        expect(zodErrorToMessage(new Error("boom"))).toBe("boom");
    });
});
