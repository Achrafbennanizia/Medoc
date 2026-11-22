import { describe, expect, it } from "vitest";
import { settingsSectionVisible } from "./rbac";

const allow = (action: string) => [{ action, effect: "ALLOW" as const }];
const deny = (action: string) => [{ action, effect: "DENY" as const }];

describe("settings sections follow privileges, not the login role", () => {
    it("a receptionist given practice settings rights sees the practice section", () => {
        expect(settingsSectionVisible("practice", "RECEPTION")).toBe(false);
        expect(settingsSectionVisible("practice", "RECEPTION", allow("ops.system"))).toBe(true);
    });
    it("a dentist without practice settings rights does not", () => {
        expect(settingsSectionVisible("practice", "PHYSICIAN", deny("ops.system"))).toBe(false);
    });
    it("personal sections are always there", () => {
        for (const s of ["account", "appearance", "about"]) expect(settingsSectionVisible(s, "RECEPTION", deny("ops.system"))).toBe(true);
    });
});
