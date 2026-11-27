/**
 * Solo inbox in the shell: the number of guest proposals waiting for the admin, and the notice the
 * guest sees after sending one (editions-plan.md §4.2). Nothing in editions without a guest inbox.
 */
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import {
    countPendingStagedChanges,
    isGuestSession,
    PROPOSAL_SENT_EVENT,
    PROPOSALS_CHANGED_EVENT,
} from "@/systems/practice-host/controllers/guest.controller";
import { useToastStore } from "@/views/components/ui/toast-store";

export function useGuestInboxBadge(sessionUserId: string | undefined): number {
    const t = useT();
    const toast = useToastStore((s) => s.add);
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!__CAP_GUEST_INBOX__ || !sessionUserId) return;
        const refresh = () => {
            void countPendingStagedChanges()
                .then(setCount)
                .catch(() => setCount(0));
        };
        const onSent = () => {
            toast(t("guest.inbox.sent_toast"), "success");
            refresh();
        };
        refresh();
        const id = window.setInterval(refresh, 60_000);
        window.addEventListener(PROPOSAL_SENT_EVENT, onSent);
        window.addEventListener(PROPOSALS_CHANGED_EVENT, refresh);
        return () => {
            window.clearInterval(id);
            window.removeEventListener(PROPOSAL_SENT_EVENT, onSent);
            window.removeEventListener(PROPOSALS_CHANGED_EVENT, refresh);
        };
    }, [sessionUserId, t, toast]);
    return __CAP_GUEST_INBOX__ && !isGuestSession() ? count : 0;
}
