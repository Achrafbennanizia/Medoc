/**
 * Settings → About: the update scheduled after hours (by the admin, or by itself for a security fix),
 * and the last install (editions plan §11.6, T7.6). A backup is taken right before every install.
 */
import { useCallback, useEffect, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage, formatDateTime } from "@/lib/utils";
import {
    cancelScheduledUpdate,
    getUpdateRolloutState,
    scheduleUpdate,
    type UpdateRolloutState,
} from "@/systems/practice-host/controllers/system.controller";
import { Button } from "@/views/components/ui/button";
import { useToastStore } from "@/views/components/ui/toast-store";

export function UpdateRolloutPanel({ updateAvailable }: { updateAvailable: boolean }) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [state, setState] = useState<UpdateRolloutState | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        getUpdateRolloutState()
            .then(setState)
            .catch(() => setState(null));
    }, []);
    useEffect(load, [load]);

    const run = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await fn();
            load();
        } catch (e) {
            toast(tp("settings.about.install_update_failed", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    const s = state?.scheduled;
    return (
        <div className="update-rollout">
            {s ? (
                <p className="card-sub">
                    {tp(s.kind === "security" ? "settings.about.scheduled_security" : "settings.about.scheduled_feature", {
                        version: s.version,
                        at: formatDateTime(s.at),
                    })}{" "}
                    <Button variant="ghost" size="sm" type="button" disabled={busy} onClick={() => void run(cancelScheduledUpdate)}>
                        {t("settings.about.cancel_schedule")}
                    </Button>
                </p>
            ) : updateAvailable ? (
                <Button variant="secondary" type="button" loading={busy} onClick={() => void run(() => scheduleUpdate("after_hours"))}>
                    {t("settings.about.install_after_hours")}
                </Button>
            ) : null}
            {state?.last ? (
                <p className="card-sub">{tp("settings.about.last_install", { version: state.last.version, at: formatDateTime(state.last.at) })}</p>
            ) : null}
            <p className="card-sub">{t("settings.about.backup_before_update")}</p>
        </div>
    );
}
