import { useT } from "@/lib/i18n";
import {
    statusDefinition,
    statusDescriptionKey,
    statusFlagLabelKey,
    statusLabelKey,
    statusPillClass,
    type StatusEntityId,
} from "@/lib/status/status-registry";

type StatusBadgeProps = {
    entity: StatusEntityId;
    status: string;
    /** Derived markers shown after the status (never instead of it), e.g. `["rescheduled"]`. */
    flags?: readonly string[];
    className?: string;
};

/**
 * The one way to render a status. Label, colour and tooltip come from the status registry, so the same
 * status looks and reads the same on every page (Nielsen #4 consistency, #2 match with the real world).
 */
export function StatusBadge({ entity, status, flags, className }: StatusBadgeProps) {
    const t = useT();
    const def = statusDefinition(entity, status);
    const labelKey = statusLabelKey(entity, status);
    const label = t(labelKey);
    const text = label !== labelKey ? label : status;
    const descKey = statusDescriptionKey(entity, status);
    const desc = t(descKey);
    const title = desc !== descKey ? desc : undefined;
    const flagLabels = (flags ?? []).map((f) => t(statusFlagLabelKey(entity, f)));
    return (
        <span className={["status-badge", className].filter(Boolean).join(" ")} data-status={def?.wire ?? status} data-phase={def?.phase}>
            <span className={`pill ${statusPillClass(def?.tone ?? "neutral")}`} title={title}>
                {text}
            </span>
            {flagLabels.map((f) => (
                <span key={f} className="pill grey status-badge__flag">
                    {f}
                </span>
            ))}
        </span>
    );
}
