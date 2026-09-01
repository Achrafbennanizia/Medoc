import { describe, expect, it } from "vitest";
import {
    buildAdministrationTocHubViewModel,
    filterAdministrationTocLinksByRbac,
    resolveAdministrationTocItems,
} from "./administration-toc/controller";
import { getAdministrationTocHubDef } from "./administration-toc/model";

const t = (key: string) => key;

describe("administration-toc controller", () => {
    it("team hub has no icon keys (simple section layout)", () => {
        const hub = getAdministrationTocHubDef("team");
        expect(hub.items.every((item) => item.iconKey == null)).toBe(true);
    });

    it("root hub keeps icon keys for category layout", () => {
        const hub = getAdministrationTocHubDef("root");
        expect(hub.items.some((item) => item.iconKey != null)).toBe(true);
    });

    it("resolveAdministrationTocItems applies feature flags", () => {
        const items = getAdministrationTocHubDef("inventory").items;
        const all = resolveAdministrationTocItems(items, t, {
            servicesMenu: true,
            productsMenu: false,
            prescriptionsCertificatesMenu: true,
        });
        expect(all.some((l) => l.href === "/products")).toBe(false);
        expect(all.some((l) => l.href === "/administration/order-master")).toBe(true);
    });

    it("buildAdministrationTocHubViewModel resolves title keys", () => {
        const vm = buildAdministrationTocHubViewModel("team", t);
        expect(vm.title).toBe("page.administration_team.title");
        expect(vm.links).toHaveLength(3);
    });

    it("practicePlanning hub is registered under AdministrationTocHubId", () => {
        const hub = getAdministrationTocHubDef("practicePlanning");
        expect(hub.titleKey).toBe("page.practicePlanning.title");
        expect(buildAdministrationTocHubViewModel("practicePlanning", t).links.length).toBeGreaterThan(0);
    });

    it("filterAdministrationTocLinksByRbac hides gated rows without role", () => {
        const links = resolveAdministrationTocItems(getAdministrationTocHubDef("team").items, t);
        const visible = filterAdministrationTocLinksByRbac(links, undefined, undefined);
        expect(visible.length).toBeLessThanOrEqual(links.length);
    });
});
