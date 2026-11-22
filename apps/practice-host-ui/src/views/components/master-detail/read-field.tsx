/** Label and value in a detail read view (`master-detail-read` grid). Empty values show a dash. */
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

export function ReadField({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
    const t = useT();
    const empty = value === null || value === undefined || value === "";
    return (
        <div className={wide ? "master-detail-read__field master-detail-read__field--wide" : "master-detail-read__field"}>
            <span className="kpi-label-mini">{label}</span>
            <span className="master-detail-read__value">{empty ? t("common.em_dash") : value}</span>
        </div>
    );
}
