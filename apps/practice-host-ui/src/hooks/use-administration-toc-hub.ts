import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import {
    buildAdministrationTocHubForSession,
    DEFAULT_ADMINISTRATION_TOC_FEATURE_FLAGS,
    type AdministrationTocFeatureFlags,
    type AdministrationTocHubId,
    type AdministrationTocHubViewModel,
} from "@/lib/administration-toc";
import { useAuthStore } from "@/models/store/auth-store";

/** Controller hook: model → translated links, feature flags, RBAC for a Administration hub. */
export function useAdministrationTocHub(
    hubId: AdministrationTocHubId,
    featureFlags: AdministrationTocFeatureFlags = DEFAULT_ADMINISTRATION_TOC_FEATURE_FLAGS,
): AdministrationTocHubViewModel {
    const t = useT();
    const session = useAuthStore((s) => s.session);

    return useMemo(
        () =>
            buildAdministrationTocHubForSession(
                hubId,
                t,
                session?.role,
                session?.permission_overrides,
                featureFlags,
            ),
        [hubId, t, session?.role, session?.permission_overrides, featureFlags],
    );
}
