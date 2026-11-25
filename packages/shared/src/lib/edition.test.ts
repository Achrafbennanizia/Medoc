import { describe, expect, it } from "vitest";
import { CAPS, EDITION, EDITIONS, editionMismatch, type EditionInfo } from "./edition";

const coreOf = (id: keyof typeof EDITIONS, flavor: "main" | "replica" = "main"): EditionInfo => ({
    edition: id,
    flavor,
    caps: { ...EDITIONS[id].caps },
    limits: EDITIONS[id].limits,
    version: "0.1.0",
});

describe("edition", () => {
    it("defaults to the full (group) edition in dev and tests", () => {
        expect(EDITION.id).toBe("group");
        expect(CAPS.net).toBe(true);
        expect(__CAP_NET__).toBe(true);
        expect(__CAP_GUEST_INBOX__).toBe(false);
    });

    it("accepts a matching core", () => {
        expect(editionMismatch(coreOf("solo"), { edition: EDITIONS.solo, flavor: "main" })).toEqual([]);
    });

    it("reports edition, flavor and capability differences", () => {
        const diff = editionMismatch(coreOf("duo", "replica"), { edition: EDITIONS.group, flavor: "main" });
        expect(diff).toContain("edition: core duo, ui group");
        expect(diff).toContain("flavor: core replica, ui main");
        expect(diff.some((line) => line.startsWith("capability multiDoctor"))).toBe(true);
    });
});
