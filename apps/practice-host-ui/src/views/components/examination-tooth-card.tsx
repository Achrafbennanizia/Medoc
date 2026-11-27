/** One tooth card of the examination form (split from `examination-composer.tsx`). */
import type { ReactNode } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { dentalStatusLabel, formatDentalToothLabel, type DentalStatusKey } from "@/lib/dental";

export function ExamToothCard({
    tooth,
    statusKeys,
    updatedAt,
    children,
}: {
    tooth: string;
    statusKeys: DentalStatusKey[];
    updatedAt?: string;
    children: ReactNode;
}) {
    const t = useT();
    const tp = useTParams();
    return (
        <div className="exam-tooth-card">
            <div className="exam-tooth-card__head">
                <span className="exam-tooth-card__num">{formatDentalToothLabel(tooth, t)}</span>
                {statusKeys.map((k) => (
                    <span key={k} className={`dental-arch__pill is-${k}`}>{dentalStatusLabel(t, k)}</span>
                ))}
            </div>
            {updatedAt ? (
                <p className="exam-tooth-card__meta">{tp("dental.chart.detail_updated", { date: formatDate(updatedAt) })}</p>
            ) : null}
            {children}
        </div>
    );
}
