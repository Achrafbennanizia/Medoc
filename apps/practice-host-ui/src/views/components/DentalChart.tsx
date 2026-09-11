import { useMemo, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import type { DentalFinding } from "@/models/types";
import {
    DENTAL_LOWER_L,
    DENTAL_LOWER_R,
    DENTAL_STATES,
    DENTAL_STATUS_KEYS,
    DENTAL_TOOTH_SHAPES,
    DENTAL_UPPER_L,
    DENTAL_UPPER_R,
    type DentalStatusKey,
    findingToStatusKey,
    dentalStatusLabel,
    dentalToothType,
    formatDentalToothLabel,
} from "@/lib/dental";

const UPPER_R = DENTAL_UPPER_R;
const UPPER_L = DENTAL_UPPER_L;
const LOWER_R = DENTAL_LOWER_R;
const LOWER_L = DENTAL_LOWER_L;

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
};

export function DentalChart({
    findings,
    mode = "clinical",
    selectedTooth = null,
    onToothSelect,
    onApply,
    disabled = false,
    pickerHint,
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

    const renderTooth = (n: string) => {
        const type = dentalToothType(n);
        const shape = DENTAL_TOOTH_SHAPES[type];
        const stateKey = findingToStatusKey(map.get(Number(n)));
        const state = DENTAL_STATES[stateKey];
        const isSel = mode === "picker" && selectedTooth === n;
        const label = formatDentalToothLabel(n, t);
        return (
            <button
                key={n}
                type="button"
                className={`col ${pulseTooth === n ? "tooth-btn-pulse" : ""}`}
                style={{ alignItems: "center", gap: 4, opacity: disabled ? 0.65 : undefined }}
                aria-label={tp("dental.tooth_status_aria", { tooth: label, status: dentalStatusLabel(t, stateKey) })}
                disabled={disabled}
                onClick={async () => {
                    if (disabled) return;
                    setPulseTooth(n);
                    window.setTimeout(() => setPulseTooth((cur) => (cur === n ? null : cur)), 140);
                    if (mode === "picker") {
                        onToothSelect?.(n);
                        return;
                    }
                    setLastTouched(n);
                    if (onApply) {
                        await onApply(Number(n), active);
                    }
                }}
            >
                <svg
                    width="28"
                    height="42"
                    viewBox="0 0 20 34"
                    aria-hidden
                    style={{
                        filter: isSel ? "drop-shadow(0 0 5px rgba(74,157,255,0.85))" : undefined,
                        outline: isSel ? "2px solid var(--accent)" : undefined,
                        borderRadius: 4,
                    }}
                >
                    <path d={shape.crown} fill={state.fill} stroke={state.stroke} />
                    <path d={shape.root} fill={state.fill} stroke={state.stroke} />
                </svg>
                <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{label}</span>
            </button>
        );
    };

    return (
        <div className="card card-pad">
            {mode === "clinical" ? (
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    {DENTAL_STATUS_KEYS.map((k) => (
                            <button
                                key={k}
                                type="button"
                                className={`pill ${active === k ? "accent" : "grey"}`}
                                aria-pressed={active === k}
                                disabled={disabled}
                                onClick={() => !disabled && setActive(k)}
                            >
                                {dentalStatusLabel(t, k)}
                            </button>
                    ))}
                </div>
            ) : (
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--fg-3)" }}>
                    {disabled
                        ? t("dental.chart.view_hint")
                        : pickerHint ?? t("dental.chart.pick_hint")}
                </p>
            )}
            <div className="dental-odontogram dental-odontogram--chart">
                <span className="dental-odontogram__axis dental-odontogram__axis--top" aria-hidden>
                    {t("dental.axis.top")}
                </span>
                <div className="dental-odontogram__body">
                    <span className="dental-odontogram__axis dental-odontogram__axis--start" aria-hidden>
                        {t("dental.axis.right")}
                    </span>
                    <div className="dental-odontogram__chart" role="group">
                        <div className="dental-odontogram__quad dental-odontogram__quad--ur dental-odontogram__quad--gap">
                            {UPPER_R.map(renderTooth)}
                        </div>
                        <div className="dental-odontogram__vline" aria-hidden />
                        <div className="dental-odontogram__quad dental-odontogram__quad--ul dental-odontogram__quad--gap">
                            {UPPER_L.map(renderTooth)}
                        </div>
                        <div className="dental-odontogram__hline" aria-hidden />
                        <div className="dental-odontogram__quad dental-odontogram__quad--lr dental-odontogram__quad--gap">
                            {LOWER_R.map(renderTooth)}
                        </div>
                        <div className="dental-odontogram__quad dental-odontogram__quad--ll dental-odontogram__quad--gap">
                            {LOWER_L.map(renderTooth)}
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
            <div className="card card-pad" style={{ marginTop: 14, background: "rgba(0,0,0,0.015)" }}>
                {mode === "picker"
                    ? (selectedTooth
                        ? tp("dental.chart.selected_tooth", { tooth: formatDentalToothLabel(selectedTooth, t) })
                        : t("dental.chart.no_tooth"))
                    : lastTouched
                        ? tp("dental.chart.brush_footer_tooth", {
                            tooth: formatDentalToothLabel(lastTouched, t),
                            brush: dentalStatusLabel(t, active),
                        })
                        : tp("dental.chart.brush_footer", { brush: dentalStatusLabel(t, active) })}
            </div>
        </div>
    );
}