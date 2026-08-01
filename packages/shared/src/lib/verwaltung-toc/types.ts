/** Resolved row for {@link VerwaltungTocPage} (title/desc already translated). */
export type VerwaltungTocLink = {
    title: string;
    desc: string;
    href: string;
    iconKey?: string;
    /** RoleRoute / `ROUTE_VISIBILITY` key; omit when the row is not gated on this hub. */
    requires?: string;
};

/** Static hub entry — i18n keys resolved by the controller. */
export type VerwaltungTocItemDef = {
    titleKey: string;
    descKey: string;
    href: string;
    requires?: string;
    iconKey?: string;
    /** When set, row is shown only when the matching feature flag is true. */
    featureFlag?: keyof VerwaltungTocFeatureFlags;
};

export type VerwaltungTocHubId =
    | "root"
    | "team"
    | "finanzen-berichte"
    | "lager"
    | "leistungen"
    | "praxisplanung";

export type VerwaltungTocFeatureFlags = {
    leistungenMenu: boolean;
    produkteMenu: boolean;
    rezepteAttesteMenu: boolean;
};

export type VerwaltungTocHubDef = {
    id: VerwaltungTocHubId;
    titleKey: string;
    subtitleKey: string;
    items: readonly VerwaltungTocItemDef[];
};

export type VerwaltungTocHubViewModel = {
    title: string;
    subtitle: string;
    links: VerwaltungTocLink[];
};
