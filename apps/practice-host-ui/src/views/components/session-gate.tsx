import { useEffect, type ReactNode } from "react";
import { checkSession } from "@/systems/practice-host/controllers/auth.controller";
import { mergeAutocompleteFromPraxisKvIntoLocal } from "@/lib/praxis-search-prefs-sync";
import { usePraxisArbeitszeitenStore } from "@/models/store/praxis-arbeitszeiten-store";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "../../models/store/auth-store";

/**
 * Runs once at startup so `get_session` hydrates Zustand before route guards run.
 * Without this, a full reload cleared client session while Rust still had a session.
 */
export function SessionGate({ children }: { children: ReactNode }) {
    const t = useT();
    const sessionChecked = useAuthStore((s) => s.sessionChecked);

    useEffect(() => {
        void checkSession()
            .then(() => mergeAutocompleteFromPraxisKvIntoLocal())
            .then(() => usePraxisArbeitszeitenStore.getState().hydrate())
            .catch((e) => {
                console.warn("SessionGate: checkSession failed", e);
            })
            .finally(() => {
                useAuthStore.getState().markSessionChecked();
            });
    }, []);

    if (!sessionChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-dim">
                <p className="text-body text-on-surface-variant animate-fade-in">{t("common.loading")}</p>
            </div>
        );
    }

    return <>{children}</>;
}
