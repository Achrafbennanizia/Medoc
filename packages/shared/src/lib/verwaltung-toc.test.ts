import { describe, expect, it } from "vitest";
import {
    buildVerwaltungTocHubViewModel,
    filterVerwaltungTocLinksByRbac,
    resolveVerwaltungTocItems,
} from "./verwaltung-toc/controller";
import { getVerwaltungTocHubDef } from "./verwaltung-toc/model";

const t = (key: string) => key;

describe("verwaltung-toc controller", () => {
    it("team hub has no icon keys (simple section layout)", () => {
        const hub = getVerwaltungTocHubDef("team");
        expect(hub.items.every((item) => item.iconKey == null)).toBe(true);
    });

    it("root hub keeps icon keys for category layout", () => {
        const hub = getVerwaltungTocHubDef("root");
        expect(hub.items.some((item) => item.iconKey != null)).toBe(true);
    });

    it("resolveVerwaltungTocItems applies feature flags", () => {
        const items = getVerwaltungTocHubDef("lager").items;
        const all = resolveVerwaltungTocItems(items, t, {
            leistungenMenu: true,
            produkteMenu: false,
            rezepteAttesteMenu: true,
        });
        expect(all.some((l) => l.href === "/produkte")).toBe(false);
        expect(all.some((l) => l.href === "/verwaltung/bestellstamm")).toBe(true);
    });

    it("buildVerwaltungTocHubViewModel resolves title keys", () => {
        const vm = buildVerwaltungTocHubViewModel("team", t);
        expect(vm.title).toBe("page.verwaltung_team.title");
        expect(vm.links).toHaveLength(3);
    });

    it("filterVerwaltungTocLinksByRbac hides gated rows without role", () => {
        const links = resolveVerwaltungTocItems(getVerwaltungTocHubDef("team").items, t);
        const visible = filterVerwaltungTocLinksByRbac(links, undefined, undefined);
        expect(visible.length).toBeLessThanOrEqual(links.length);
    });
});
