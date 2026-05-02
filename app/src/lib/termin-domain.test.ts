import { describe, expect, it } from "vitest";
import { TERMIN_NOTFALL_NOTIZ_MARKER, terminIstNotfallMarkiert } from "./termin-domain";
import type { Termin } from "@/models/types";

describe("terminIstNotfallMarkiert", () => {
    it("is true for BEHANDLUNG with calendar marker in notes", () => {
        const t = {
            art: "BEHANDLUNG",
            notizen: `Foo · ${TERMIN_NOTFALL_NOTIZ_MARKER}`,
        } as Termin;
        expect(terminIstNotfallMarkiert(t)).toBe(true);
    });

    it("is false without marker or wrong art", () => {
        expect(terminIstNotfallMarkiert({ art: "BEHANDLUNG", notizen: null } as Termin)).toBe(false);
        expect(terminIstNotfallMarkiert({ art: "KONTROLLE", notizen: TERMIN_NOTFALL_NOTIZ_MARKER } as Termin)).toBe(false);
    });
});
