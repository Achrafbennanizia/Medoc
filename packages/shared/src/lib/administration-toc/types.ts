/** Resolved row for {@link AdministrationTocPage} (title/desc already translated). */
export type AdministrationTocLink = {
    title: string;
    desc: string;
    href: string;
    iconKey?: string;
    /** RoleRoute / `ROUTE_VISIBILITY` key; omit when the row is not gated on this hub. */
    requires?: string;
};

/** Static hub entry — i18n keys resolved by the controller. */
export type AdministrationTocItemDef = {
    titleKey: string;
    descKey: string;
    href: string;
    requires?: string;
    iconKey?: string;
    /** When set, row is shown only when the matching feature flag is true. */
    featureFlag?: keyof AdministrationTocFeatureFlags;
};

export type AdministrationTocHubId =
    | "root"
    | "team"
    | "finance-berichte"
    | "inventory"
    | "services"
    | "practicePlanning";

export type AdministrationTocFeatureFlags = {
    servicesMenu: boolean;
    productsMenu: boolean;
    prescriptionsCertificatesMenu: boolean;
};

export type AdministrationTocHubDef = {
    id: AdministrationTocHubId;
    titleKey: string;
    subtitleKey: string;
    items: readonly AdministrationTocItemDef[];
};

export type AdministrationTocHubViewModel = {
    title: string;
    subtitle: string;
    links: AdministrationTocLink[];
};
