import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import {
    buildVerwaltungTocHubForSession,
    DEFAULT_VERWALTUNG_TOC_FEATURE_FLAGS,
    type VerwaltungTocFeatureFlags,
    type VerwaltungTocHubId,
    type VerwaltungTocHubViewModel,
} from "@/lib/verwaltung-toc";
import { useAuthStore } from "@/models/store/auth-store";

/** Controller hook: model → translated links, feature flags, RBAC for a Verwaltung hub. */
export function useVerwaltungTocHub(
    hubId: VerwaltungTocHubId,
    featureFlags: VerwaltungTocFeatureFlags = DEFAULT_VERWALTUNG_TOC_FEATURE_FLAGS,
): VerwaltungTocHubViewModel {
    const t = useT();
    const session = useAuthStore((s) => s.session);

    return useMemo(
        () =>
            buildVerwaltungTocHubForSession(
                hubId,
                t,
                session?.rolle,
                session?.permission_overrides,
                featureFlags,
            ),
        [hubId, t, session?.rolle, session?.permission_overrides, featureFlags],
    );
}
