/** Scrollable finding strips beside a tooth chart. One row is the selected-tooth detail. */
import { useMemo } from "react";
import type { DentalFinding } from "@/models/types";
import { dentalStatusLabel, findingToStatusKey, formatDentalToothLabel } from "@/lib/dental";
import { useT, useTParams } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

type TreatmentFindingListProps = {
    findings: DentalFinding[];
    selectedTooth: string | null;
    onSelect: (fdi: string) => void;
    disabled?: boolean;
};

export function TreatmentFindingList({ findings, selectedTooth, onSelect, disabled = false }: TreatmentFindingListProps) {
    const t = useT();
    const tp = useTParams();
    const rows = useMemo(() => {
        const latest = new Map<string, DentalFinding | null>();
        for (const finding of findings) {
            const fdi = String(finding.tooth_number);
            const prev = latest.get(fdi);
            if (!prev || (finding.updated_at ?? "").localeCompare(prev.updated_at ?? "") > 0) latest.set(fdi, finding);
        }
        if (selectedTooth && !latest.has(selectedTooth)) latest.set(selectedTooth, null);
        return [...latest.entries()]
            .map(([fdi, finding]) => ({ fdi, finding }))
            .sort((a, b) => Number(a.fdi) - Number(b.fdi));
    }, [findings, selectedTooth]);

    if (rows.length === 0) {
        return <p className="treatment-finding treatment-finding--empty">{t("dental.chart.no_tooth")}</p>;
    }

    return (
        <ul className="treatment-finding-list" aria-label={t("dental.mini.title")}>
            {rows.map(({ fdi, finding }) => {
                const stateKey = findingToStatusKey(finding?.finding);
                const note = finding?.diagnosis?.trim() || finding?.notes?.trim() || finding?.finding?.trim() || t("dental.chart.detail_empty");
                const meta = disabled
                    ? t("dental.chart.view_hint")
                    : finding
                        ? tp("dental.chart.detail_updated", { date: formatDate(finding.updated_at || finding.created_at) })
                        : t("dental.chart.pick_hint");
                return (
                    <li key={fdi}>
                        <button
                            type="button"
                            className={`treatment-finding${selectedTooth === fdi ? " is-selected" : ""}`}
                            disabled={disabled}
                            aria-pressed={selectedTooth === fdi}
                            onClick={() => onSelect(fdi)}
                        >
                            <span className="treatment-finding__head">
                                <span className="treatment-finding__num">{formatDentalToothLabel(fdi, t)}</span>
                                <span className={`dental-arch__pill is-${stateKey}`}>{dentalStatusLabel(t, stateKey)}</span>
                            </span>
                            <span className="dental-arch__detail-note">{note}</span>
                            <span className="dental-arch__detail-meta">{meta}</span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
