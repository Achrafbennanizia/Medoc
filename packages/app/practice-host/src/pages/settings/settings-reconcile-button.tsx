/**
 * "Reconcile now" for a replica, and the result of the last update check (run automatically when
 * the link to the main device comes back: queued changes sent, new ones fetched, digests compared).
 */
import { useEffect, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { syncLastUpdateCheck, syncReconcileNow, type UpdateCheckReport } from "@/systems/practice-host/controllers/sync.controller";
import { Button } from "@/views/components/ui/button";
import { useToastStore } from "@/views/components/ui/toast-store";

export function SettingsReconcileButton({ onDone, small }: { onDone: () => void | Promise<void>; small?: boolean }) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [busy, setBusy] = useState(false);
    const [last, setLast] = useState<UpdateCheckReport | null>(null);

    useEffect(() => {
        void syncLastUpdateCheck().then(setLast).catch(() => setLast(null));
    }, [busy]);

    const run = async () => {
        setBusy(true);
        try {
            const report = await syncReconcileNow();
            if (report.error) toast(report.error, "warning");
            else toast(tp("settings.deployment.toast.reconcile_done", { applied: report.applied }), "success");
            await onDone();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button type="button" variant="ghost" size={small ? "sm" : undefined} loading={busy} disabled={busy} onClick={() => void run()}>
                {t("settings.deployment.reconcile_now")}
            </Button>
            {last ? (
                <span className="settings-update-check" role="status">
                    {last.complete
                        ? tp("settings.deployment.update_check.done", { at: formatDateTime(last.at), pushed: last.pushed, pulled: last.pulled, repaired: last.repaired })
                        : tp("settings.deployment.update_check.pending", { at: formatDateTime(last.at) })}
                </span>
            ) : null}
        </>
    );
}
