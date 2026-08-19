import {
    SERVICES_MENU_ENABLED,
    PRODUCTS_MENU_ENABLED,
    PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED,
} from "../catalog-menu-flags";
import { routeChildPathAllowed, type PermissionOverride } from "../rbac";
import { getAdministrationTocHubDef } from "./model";
import type {
    AdministrationTocFeatureFlags,
    AdministrationTocHubId,
    AdministrationTocHubViewModel,
    AdministrationTocItemDef,
    AdministrationTocLink,
} from "./types";

export type TranslateFn = (key: string) => string;

export const DEFAULT_ADMINISTRATION_TOC_FEATURE_FLAGS: AdministrationTocFeatureFlags = {
    servicesMenu: SERVICES_MENU_ENABLED,
    productsMenu: PRODUCTS_MENU_ENABLED,
    prescriptionsCertificatesMenu: PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED,
};

function itemEnabled(
    item: AdministrationTocItemDef,
    flags: AdministrationTocFeatureFlags,
): boolean {
    if (!item.featureFlag) return true;
    return flags[item.featureFlag];
}

export function resolveAdministrationTocItems(
    items: readonly AdministrationTocItemDef[],
    t: TranslateFn,
    flags: AdministrationTocFeatureFlags = DEFAULT_ADMINISTRATION_TOC_FEATURE_FLAGS,
): AdministrationTocLink[] {
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

export function filterAdministrationTocLinksByRbac(
    links: readonly AdministrationTocLink[],
    role: string | undefined,
    overrides: PermissionOverride[] | undefined,
): AdministrationTocLink[] {
    return links.filter((link) =>
        link.requires != null && link.requires !== ""
            ? routeChildPathAllowed(link.requires, role, overrides)
            : true,
    );
}

/** Build a hub view-model: translate labels, apply feature flags (not RBAC). */
export function buildAdministrationTocHubViewModel(
    hubId: AdministrationTocHubId,
    t: TranslateFn,
    flags: AdministrationTocFeatureFlags = DEFAULT_ADMINISTRATION_TOC_FEATURE_FLAGS,
): AdministrationTocHubViewModel {
    const hub = getAdministrationTocHubDef(hubId);
    return {
        title: t(hub.titleKey),
        subtitle: t(hub.subtitleKey),
        links: resolveAdministrationTocItems(hub.items, t, flags),
    };
}

/** Full hub payload for UI: translate, feature flags, and RBAC. */
export function buildAdministrationTocHubForSession(
    hubId: AdministrationTocHubId,
    t: TranslateFn,
    role: string | undefined,
    overrides: PermissionOverride[] | undefined,
    flags: AdministrationTocFeatureFlags = DEFAULT_ADMINISTRATION_TOC_FEATURE_FLAGS,
): AdministrationTocHubViewModel {
    const vm = buildAdministrationTocHubViewModel(hubId, t, flags);
    return {
        ...vm,
        links: filterAdministrationTocLinksByRbac(vm.links, role, overrides),
    };
}
