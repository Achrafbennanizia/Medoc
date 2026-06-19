import { useMemo, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import type { Zahnbefund } from "@/models/types";
import {
    DENTAL_LOWER_L,
    DENTAL_LOWER_R,
    DENTAL_STATES,
    DENTAL_STATUS_KEYS,
    DENTAL_TOOTH_SHAPES,
    DENTAL_UPPER_L,
    DENTAL_UPPER_R,
    type DentalStatusKey,
    befundToStatusKey,
    dentalToothType,
} from "@/lib/dental";

const UPPER_R = DENTAL_UPPER_R;
const UPPER_L = DENTAL_UPPER_L;
const LOWER_R = DENTAL_LOWER_R;
const LOWER_L = DENTAL_LOWER_L;

type DentalChartProps = {
    befunde: Zahnbefund[];
    /** Clinical: paint status chips + write befunde via onApply. Picker: only select tooth for forms. */
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
    befunde,
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
        befunde.forEach((b) => m.set(b.zahn_nummer, b.befund));
        return m;
    }, [befunde]);

    const renderTooth = (n: string) => {
        const type = dentalToothType(n);
        const shape = DENTAL_TOOTH_SHAPES[type];
        const stateKey = befundToStatusKey(map.get(Number(n)));
        const state = DENTAL_STATES[stateKey];
        const isSel = mode === "picker" && selectedTooth === n;
        return (
            <button
                key={n}
                type="button"
                className={`col ${pulseTooth === n ? "tooth-btn-pulse" : ""}`}
                style={{ alignItems: "center", gap: 4, opacity: disabled ? 0.65 : undefined }}
                aria-label={tp("dental.tooth_status_aria", { tooth: n, status: state.label })}
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
                <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{n}</span>
            </button>
        );
    };

    return (
        <div className="card card-pad">
            {mode === "clinical" ? (
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    {DENTAL_STATUS_KEYS.map((k) => {
                        const v = DENTAL_STATES[k];
                        return (
                            <button
                                key={k}
                                type="button"
                                className={`pill ${active === k ? "accent" : "grey"}`}
                                aria-pressed={active === k}
                                disabled={disabled}
                                onClick={() => !disabled && setActive(k)}
                            >
                                {v.label}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--fg-3)" }}>
                    {disabled
                        ? t("dental.chart.view_hint")
                        : pickerHint ?? t("dental.chart.pick_hint")}
                </p>
            )}
            <div className="col" style={{ gap: 16 }}>
                <div className="row" style={{ justifyContent: "center", gap: 8 }}>{UPPER_R.map(renderTooth)}{UPPER_L.map(renderTooth)}</div>
                <div style={{ borderTop: "1px dashed var(--line-strong)" }} />
                <div className="row" style={{ justifyContent: "center", gap: 8 }}>{LOWER_R.map(renderTooth)}{LOWER_L.map(renderTooth)}</div>
            </div>
            <div className="card card-pad" style={{ marginTop: 14, background: "rgba(0,0,0,0.015)" }}>
                {mode === "picker"
                    ? (selectedTooth ? tp("dental.chart.selected_tooth", { tooth: selectedTooth }) : t("dental.chart.no_tooth"))
                    : lastTouched
                        ? tp("dental.chart.brush_footer_tooth", { tooth: lastTouched, brush: DENTAL_STATES[active].label })
                        : tp("dental.chart.brush_footer", { brush: DENTAL_STATES[active].label })}
            </div>
        </div>
    );
}