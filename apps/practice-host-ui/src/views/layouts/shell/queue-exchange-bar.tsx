/** Thin progress bar while the sync queues relevant to the current page are exchanged. */
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { syncExchangeQueues } from "@/systems/practice-host/controllers/sync.controller";
import { queuesForPath } from "./queues-for-path";

export function QueueExchangeBar({ pathname }: { pathname: string }) {
    const t = useT();
    const key = queuesForPath(pathname)?.join(",") ?? "";
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        // Keyed by the joined queue names so a new array for the same queues does not refetch.
        const list = key ? key.split(",") : null;
        if (!list) {
            setBusy(false);
            return;
        }
        let cancelled = false;
        setBusy(true);
        syncExchangeQueues(list)
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setBusy(false);
            });
        return () => {
            cancelled = true;
        };
    }, [key]);
    if (!busy) return null;
    return <div className="queue-exchange-bar" role="status" aria-label={t("common.loading")} />;
}
