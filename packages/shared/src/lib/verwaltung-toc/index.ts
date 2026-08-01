export type {
    VerwaltungTocFeatureFlags,
    VerwaltungTocHubDef,
    VerwaltungTocHubId,
    VerwaltungTocHubViewModel,
    VerwaltungTocItemDef,
    VerwaltungTocLink,
} from "./types";
export { VERWALTUNG_TOC_HUBS, getVerwaltungTocHubDef } from "./model";
export {
    DEFAULT_VERWALTUNG_TOC_FEATURE_FLAGS,
    buildVerwaltungTocHubForSession,
    buildVerwaltungTocHubViewModel,
    filterVerwaltungTocLinksByRbac,
    resolveVerwaltungTocItems,
    type TranslateFn,
} from "./controller";
