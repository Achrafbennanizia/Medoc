import { describe, expect, it } from "vitest";
import { TERMIN_NOTFALL_NOTIZ_MARKER } from "@/lib/termin-domain";
import {
    appointmentStateDisplay,
    terminArtLabel,
    terminArtLabelFromTermin,
    terminCountsAsPlanned,
} from "@/lib/termin-calendar-ui";
import type { Termin } from "@/models/types";

function termin(partial: Partial<Termin>): Termin {
    return {
        id: "t1",
        datum: "2026-05-20",
        uhrzeit: "10:00",
        art: "KONTROLLE",
        status: "GEPLANT",
        notizen: null,
        beschwerden: null,
        patient_id: "p1",
        arzt_id: "a1",
        created_at: "2026-05-20T08:00:00Z",
        updated_at: "2026-05-20T08:00:00Z",
        ...partial,
    };
}

describe("termin-calendar-ui", () => {
    it("terminArtLabel maps known art", () => {
        expect(terminArtLabel("KONTROLLE")).toBe("Kontrolle");
    });

    it("terminArtLabelFromTermin detects Notfall marker", () => {
        expect(
            terminArtLabelFromTermin(
                termin({ art: "BEHANDLUNG", notizen: TERMIN_NOTFALL_NOTIZ_MARKER }),
            ),
        ).toBe("Notfall");
    });

    it("appointmentStateDisplay storniert", () => {
        expect(appointmentStateDisplay(termin({ status: "ABGESAGT" })).label).toBe("Storniert");
    });

    it("terminCountsAsPlanned excludes cancelled", () => {
        expect(terminCountsAsPlanned(termin({ status: "NICHT_ERSCHIENEN" }))).toBe(false);
        expect(terminCountsAsPlanned(termin({ status: "GEPLANT" }))).toBe(true);
    });
});
