import { describe, expect, it } from "vitest";
import type { AccessCatalog } from "@/systems/practice-host/controllers/access.controller";
import { ownScopes } from "@/systems/practice-host/controllers/access.controller";
import { grantsFor } from "./use-staff-access";

const catalog = {
    roles: [{ id: "reception.front_desk", baseRole: "RECEPTION", levels: { calendar: "full", cash_desk: "full", billing: "create" } }],
} as unknown as AccessCatalog;

describe("saving a person's privileges", () => {
    it("stores only the areas that differ from the chosen role", () => {
        const draft = { role: "reception.front_desk", levels: { calendar: "full", cash_desk: "view", billing: "create" }, own: [] } as const;
        expect(grantsFor({ ...draft, levels: { ...draft.levels } }, catalog)).toEqual({ cash_desk: "view" });
    });
    it("stores nothing when the role is used as it is", () => {
        expect(grantsFor({ role: "reception.front_desk", levels: { calendar: "full", cash_desk: "full", billing: "create" }, own: [] }, catalog)).toEqual({});
    });
    it("reads own-record scopes from the person's entries", () => {
        expect(ownScopes({ actionOverrides: [{ action: "scope.own.calendar", effect: "ALLOW" }, { action: "cash.create", effect: "DENY" }] })).toEqual(["calendar"]);
    });
});
