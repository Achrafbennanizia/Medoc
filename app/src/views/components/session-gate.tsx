import { useEffect, type ReactNode } from "react";
import { checkSession } from "../../controllers/auth.controller";
import { mergeAutocompleteFromPraxisKvIntoLocal } from "@/lib/praxis-search-prefs-sync";
import { useAuthStore } from "../../models/store/auth-store";

/**
 * Runs once at startup so `get_session` hydrates Zustand before route guards run.
 * Without this, a full reload cleared client session while Rust still had a session.
 */
export function SessionGate({ children }: { children: ReactNode }) {
    const sessionChecked = useAuthStore((s) => s.sessionChecked);

    useEffect(() => {
        void checkSession()
            .then(() => mergeAutocompleteFromPraxisKvIntoLocal())
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
                <p className="text-body text-on-surface-variant animate-fade-in">Wird geladen…</p>
            </div>
        );
    }

    return <>{children}</>;
}
