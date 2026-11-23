import { useMemo, useState } from "react";
import { DentalArchSvg } from "./dental-arch-svg";
import { DentalOdontogramAxis } from "./dental-odontogram-axis";
import type { DentalFinding } from "@/models/types";
import {
    DENTAL_STATUS_KEYS,
    type DentalStatusKey,
    findingToStatusKeys,
    dentalStatusLabel,
    findingsForTooth,
    formatDentalToothLabel,
} from "@/lib/dental";
import { useT, useTParams } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

type DentalChartProps = {
    findings: DentalFinding[];
    /** Clinical: paint status chips + write findings via onApply. Picker: only select tooth for forms. */
    mode?: "clinical" | "picker";
    /** Picker: currently selected FDI tooth (e.g. "11"). */
    selectedTooth?: string | null;
    /** Picker: when user clicks a tooth. */
    onToothSelect?: (fdi: string) => void;
    /** Clinical: apply status key to tooth (persisted by parent). */
    onApply?: (tooth: number, statusKey: string) => Promise<void>;
    /** Picker: override the helper line below the palette (defaults to i18n copy). */
    pickerHint?: string;
    /** View only — no tooth selection / no finding set (view mode). */
    disabled?: boolean;
    /** Show the selected-tooth strip under the chart. Off when the parent renders its own tooth card. */
    detail?: boolean;
};

export function DentalChart({
    findings,
    mode = "clinical",
    selectedTooth = null,
    onToothSelect,
    onApply,
    disabled = false,
    pickerHint,
    detail = true,
}: DentalChartProps) {
    const t = useT();
    const tp = useTParams();
    const [active, setActive] = useState<DentalStatusKey>("healthy");
    const [pulseTooth, setPulseTooth] = useState<string | null>(null);
    const [lastTouched, setLastTouched] = useState<string | null>(null);
    const map = useMemo(() => {
        const m = new Map<number, string>();
        findings.forEach((b) => m.set(b.tooth_number, b.finding));
        return m;
    }, [findings]);

    const focusTooth = mode === "picker" ? selectedTooth : lastTouched;

    const activate = async (n: string) => {
        if (disabled) return;
        setPulseTooth(n);
        window.setTimeout(() => setPulseTooth((cur) => (cur === n ? null : cur)), 160);
        if (mode === "picker") {
            onToothSelect?.(n);
            return;
        }
        setLastTouched(n);
        if (onApply) {
            await onApply(Number(n), active);
        }
    };

    const focusFindings = focusTooth ? findingsForTooth(findings, focusTooth) : [];
    const latest = focusFindings.length
        ? [...focusFindings].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0]
        : null;
    const focusState = focusTooth ? findingToStatusKeys(map.get(Number(focusTooth)))[0] : null;
    const hint =
        mode === "picker"
            ? disabled
                ? t("dental.chart.view_hint")
                : pickerHint ?? t("dental.chart.pick_hint")
            : focusTooth
              ? tp("dental.chart.brush_footer_tooth", {
                    tooth: formatDentalToothLabel(focusTooth, t),
                    brush: dentalStatusLabel(t, active),
                })
              : tp("dental.chart.brush_footer", { brush: dentalStatusLabel(t, active) });

    return (
        <div className={`card dental-arch${disabled ? " is-disabled" : ""}`}>
            <div className="dental-arch__head">
                {mode === "clinical" ? (
                    <div className="dental-arch__brushes" role="group" aria-label={t("dental.chart.legend")}>
                        {DENTAL_STATUS_KEYS.map((k) => (
                            <button
                                key={k}
                                type="button"
                                className={`dental-arch__brush is-${k}`}
                                aria-pressed={active === k}
                                disabled={disabled}
                                onClick={() => !disabled && setActive(k)}
                            >
                                <span className="dental-arch__swatch" aria-hidden />
                                {dentalStatusLabel(t, k)}
                            </button>
                        ))}
                    </div>
                ) : (
                    <ul className="dental-arch__legend" aria-label={t("dental.chart.legend")}>
                        {DENTAL_STATUS_KEYS.filter((k) => k !== "healthy").map((k) => (
                            <li key={k} className={`is-${k}`}>
                                <span className="dental-arch__swatch" aria-hidden />
                                {dentalStatusLabel(t, k)}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="dental-arch__frame" dir="ltr">
                <DentalOdontogramAxis slot="start">{t("dental.axis.right")}</DentalOdontogramAxis>
                <DentalArchSvg
                    findings={map}
                    label={hint}
                    disabled={disabled}
                    pulseTooth={pulseTooth}
                    isSelected={(n) => n === focusTooth}
                    onActivate={disabled ? undefined : (n) => void activate(n)}
                />
                <DentalOdontogramAxis slot="end">{t("dental.axis.left")}</DentalOdontogramAxis>
            </div>
            {detail ? (
                <div className="dental-arch__detail" aria-live="polite">
                    {focusTooth && focusState ? (
                        <>
                            <div className="dental-arch__detail-tooth">
                                <span className="dental-arch__detail-num">{formatDentalToothLabel(focusTooth, t)}</span>
                                <span className={`dental-arch__pill is-${focusState}`}>{dentalStatusLabel(t, focusState)}</span>
                            </div>
                            <div className="dental-arch__detail-body">
                                <p className="dental-arch__detail-note">
                                    {latest?.diagnosis?.trim() || latest?.notes?.trim() || latest?.finding?.trim() || t("dental.chart.detail_empty")}
                                </p>
                                <p className="dental-arch__detail-meta">
                                    {latest
                                        ? tp("dental.chart.detail_updated", { date: formatDate(latest.updated_at || latest.created_at) })
                                        : hint}
                                </p>
                            </div>
                        </>
                    ) : (
                        <p className="dental-arch__detail-meta">
                            {mode === "picker" && !disabled ? t("dental.chart.no_tooth") + " — " + hint : hint}
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
