import { useMemo } from "react";
import { useT, useTParams } from "@/lib/i18n";
import type { DentalFinding } from "@/models/types";
import {
    DENTAL_LOWER_L,
    DENTAL_LOWER_R,
    DENTAL_STATES,
    DENTAL_TOOTH_SHAPES,
    DENTAL_UPPER_L,
    DENTAL_UPPER_R,
    findingToStatusKey,
    dentalToothType,
    formatDentalToothLabel,
    formatDentalToothList,
    sortFdiTeeth,
} from "@/lib/dental";

type DentalToothPickerMiniProps = {
    findings: DentalFinding[];
    /** Selected FDI numbers (e.g. `["14","16"]`). */
    selectedTeeth: string[];
    /** Toggle selection for one tooth (multi-select). */
    onToggleTooth: (fdi: string) => void;
    /** Short reception hint (shown above chart). */
    hint?: string;
};

/**
 * Compact FDI tooth chart for forms (e.g. appointment toothache).
 * Smaller than full {@link DentalChart}; no nested cards.
 */
export function DentalToothPickerMini({
    findings,
    selectedTeeth,
    onToggleTooth,
    hint,
}: DentalToothPickerMiniProps) {
    const t = useT();
    const tp = useTParams();
    const map = useMemo(() => {
        const m = new Map<number, string>();
        findings.forEach((b) => m.set(b.tooth_number, b.finding));
        return m;
    }, [findings]);

    const selectedSet = useMemo(() => new Set(selectedTeeth), [selectedTeeth]);
    const pickedLabel = useMemo(() => sortFdiTeeth(selectedTeeth), [selectedTeeth]);

    const renderTooth = (n: string) => {
        const type = dentalToothType(n);
        const shape = DENTAL_TOOTH_SHAPES[type];
        const stateKey = findingToStatusKey(map.get(Number(n)));
        const state = DENTAL_STATES[stateKey];
        const isSel = selectedSet.has(n);
        const label = formatDentalToothLabel(n, t);
        return (
            <button
                key={n}
                type="button"
                className={`dental-mini-tooth-btn${isSel ? " dental-mini-tooth-btn--selected" : ""}`}
                aria-label={tp("dental.tooth_aria", { tooth: label })}
                aria-pressed={isSel}
                onClick={() => onToggleTooth(n)}
            >
                <svg width="20" height="32" viewBox="0 0 20 34" aria-hidden className="dental-mini-tooth-svg">
                    <path
                        d={shape.crown}
                        fill={state.fill}
                        stroke={state.stroke}
                        strokeWidth={isSel ? 1.35 : 0.85}
                    />
                    <path
                        d={shape.root}
                        fill={state.fill}
                        stroke={state.stroke}
                        strokeWidth={isSel ? 1.35 : 0.85}
                    />
                </svg>
                <span className="dental-mini-tooth-num">{label}</span>
            </button>
        );
    };

    return (
        <div className="dental-tooth-picker-mini">
            <p className="dental-tooth-picker-mini__hint">{hint ?? t("dental.picker.hint")}</p>
            {pickedLabel.length ? (
                <p className="dental-tooth-picker-mini__picked">
                    {t("dental.picker.selected_label")}{" "}
                    <strong>
                        {pickedLabel.length === 1
                            ? tp("dental.picker.one_tooth", { tooth: formatDentalToothLabel(pickedLabel[0]!, t) })
                            : tp("dental.picker.many_teeth", { teeth: formatDentalToothList(pickedLabel, t) })}
                    </strong>
                </p>
            ) : null}
            <div className="dental-odontogram dental-odontogram--picker">
                <span className="dental-odontogram__axis dental-odontogram__axis--top" aria-hidden>
                    {t("dental.axis.top")}
                </span>
                <div className="dental-odontogram__body">
                    <span className="dental-odontogram__axis dental-odontogram__axis--start" aria-hidden>
                        {t("dental.axis.right")}
                    </span>
                    <div className="dental-odontogram__chart" role="group">
                        <div className="dental-odontogram__quad dental-odontogram__quad--ur dental-odontogram__quad--gap-sm">
                            {DENTAL_UPPER_R.map(renderTooth)}
                        </div>
                        <div className="dental-odontogram__vline" aria-hidden />
                        <div className="dental-odontogram__quad dental-odontogram__quad--ul dental-odontogram__quad--gap-sm">
                            {DENTAL_UPPER_L.map(renderTooth)}
                        </div>
                        <div className="dental-odontogram__hline" aria-hidden />
                        <div className="dental-odontogram__quad dental-odontogram__quad--lr dental-odontogram__quad--gap-sm">
                            {DENTAL_LOWER_R.map(renderTooth)}
                        </div>
                        <div className="dental-odontogram__quad dental-odontogram__quad--ll dental-odontogram__quad--gap-sm">
                            {DENTAL_LOWER_L.map(renderTooth)}
                        </div>
                    </div>
                    <span className="dental-odontogram__axis dental-odontogram__axis--end" aria-hidden>
                        {t("dental.axis.left")}
                    </span>
                </div>
                <span className="dental-odontogram__axis dental-odontogram__axis--bottom" aria-hidden>
                    {t("dental.axis.bottom")}
                </span>
            </div>
        </div>
    );
}
