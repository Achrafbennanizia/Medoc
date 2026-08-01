import {
    LEISTUNGEN_MENU_ENABLED,
    PRODUKTE_MENU_ENABLED,
    REZEPTE_ATTESTE_MENU_ENABLED,
} from "../catalog-menu-flags";
import { routeChildPathAllowed, type PermissionOverride } from "../rbac";
import { getVerwaltungTocHubDef } from "./model";
import type {
    VerwaltungTocFeatureFlags,
    VerwaltungTocHubId,
    VerwaltungTocHubViewModel,
    VerwaltungTocItemDef,
    VerwaltungTocLink,
} from "./types";

export type TranslateFn = (key: string) => string;

export const DEFAULT_VERWALTUNG_TOC_FEATURE_FLAGS: VerwaltungTocFeatureFlags = {
    leistungenMenu: LEISTUNGEN_MENU_ENABLED,
    produkteMenu: PRODUKTE_MENU_ENABLED,
    rezepteAttesteMenu: REZEPTE_ATTESTE_MENU_ENABLED,
};

function itemEnabled(
    item: VerwaltungTocItemDef,
    flags: VerwaltungTocFeatureFlags,
): boolean {
    if (!item.featureFlag) return true;
    return flags[item.featureFlag];
}

export function resolveVerwaltungTocItems(
    items: readonly VerwaltungTocItemDef[],
    t: TranslateFn,
    flags: VerwaltungTocFeatureFlags = DEFAULT_VERWALTUNG_TOC_FEATURE_FLAGS,
): VerwaltungTocLink[] {
    return items
        .filter((item) => itemEnabled(item, flags))
        .map((item) => ({
            title: t(item.titleKey),
            desc: t(item.descKey),
            href: item.href,
            ...(item.iconKey ? { iconKey: item.iconKey } : {}),
            ...(item.requires ? { requires: item.requires } : {}),
        }));
}

export function filterVerwaltungTocLinksByRbac(
    links: readonly VerwaltungTocLink[],
    rolle: string | undefined,
    overrides: PermissionOverride[] | undefined,
): VerwaltungTocLink[] {
    return links.filter((link) =>
        link.requires != null && link.requires !== ""
            ? routeChildPathAllowed(link.requires, rolle, overrides)
            : true,
    );
}

/** Build a hub view-model: translate labels, apply feature flags (not RBAC). */
export function buildVerwaltungTocHubViewModel(
    hubId: VerwaltungTocHubId,
    t: TranslateFn,
    flags: VerwaltungTocFeatureFlags = DEFAULT_VERWALTUNG_TOC_FEATURE_FLAGS,
): VerwaltungTocHubViewModel {
    const hub = getVerwaltungTocHubDef(hubId);
    return {
        title: t(hub.titleKey),
        subtitle: t(hub.subtitleKey),
        links: resolveVerwaltungTocItems(hub.items, t, flags),
    };
}

/** Full hub payload for UI: translate, feature flags, and RBAC. */
export function buildVerwaltungTocHubForSession(
    hubId: VerwaltungTocHubId,
    t: TranslateFn,
    rolle: string | undefined,
    overrides: PermissionOverride[] | undefined,
    flags: VerwaltungTocFeatureFlags = DEFAULT_VERWALTUNG_TOC_FEATURE_FLAGS,
): VerwaltungTocHubViewModel {
    const vm = buildVerwaltungTocHubViewModel(hubId, t, flags);
    return {
        ...vm,
        links: filterVerwaltungTocLinksByRbac(vm.links, rolle, overrides),
    };
}
