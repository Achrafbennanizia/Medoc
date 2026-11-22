import { type KeyboardEvent, useMemo, useState } from "react";
import { DentalOdontogramAxis } from "./dental-odontogram-axis";
import type { DentalFinding } from "@/models/types";
import {
    DENTAL_LOWER_L,
    DENTAL_LOWER_R,
    DENTAL_STATUS_KEYS,
    DENTAL_UPPER_L,
    DENTAL_UPPER_R,
    type DentalStatusKey,
    findingToStatusKey,
    dentalStatusLabel,
    dentalToothType,
    findingsForTooth,
    formatDentalToothLabel,
} from "@/lib/dental";
import { useT, useTParams } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

const UPPER = [...DENTAL_UPPER_R, ...DENTAL_UPPER_L];
const LOWER = [...DENTAL_LOWER_R, ...DENTAL_LOWER_L];

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
    /** When false, the strip under the chart is omitted because the side list shows it. */
    showDetail?: boolean;
};

/* ---------- arch geometry (SVG user units) ---------- */
const GAP = 4;
const CROWN_H = 30;
const ARCH_DIP = 20; // how far the outer molars rise/fall from the midline teeth

function toothWidth(fdi: string): number {
    const type = dentalToothType(fdi);
    if (type === "incisor") return 24;
    if (type === "canine") return 26;
    if (type === "premolar") return 28;
    return 36;
}

/** Crown + roots drawn with the biting edge at y=0 and the roots toward +y. Upper teeth are flipped by the caller. */
function toothPaths(fdi: string): { crown: string; roots: string } {
    const w = toothWidth(fdi);
    const n = CROWN_H;
    const type = dentalToothType(fdi);
    const tuck = n - 6;
    if (type === "incisor") {
        return {
            crown: `M6 ${n} Q2 18 3 8 Q4 2 9 2 H${w - 9} Q${w - 4} 2 ${w - 3} 8 Q${w - 2} 18 ${w - 6} ${n} Q${w / 2} ${n + 1} 6 ${n} Z`,
            roots: `M${w * 0.34} ${tuck} Q${w * 0.28} 46 ${w / 2} 58 Q${w * 0.72} 46 ${w * 0.66} ${tuck} Z`,
        };
    }
    if (type === "canine") {
        return {
            crown: `M6 ${n} Q3 16 5 11 Q4 5 ${w * 0.34} 3 Q${w / 2} -1 ${w * 0.66} 3 Q${w - 4} 5 ${w - 5} 11 Q${w - 3} 16 ${w - 6} ${n} Q${w / 2} ${n + 1} 6 ${n} Z`,
            roots: `M${w * 0.32} ${tuck} Q${w * 0.24} 50 ${w / 2} 68 Q${w * 0.76} 50 ${w * 0.68} ${tuck} Z`,
        };
    }
    if (type === "premolar") {
        return {
            crown: `M5 ${n} Q2 16 3 8 Q4 2 ${w * 0.3} 1.5 Q${w * 0.42} 5 ${w / 2} 3.5 Q${w * 0.58} 5 ${w * 0.7} 1.5 Q${w - 4} 2 ${w - 3} 8 Q${w - 2} 16 ${w - 5} ${n} Q${w / 2} ${n + 1} 5 ${n} Z`,
            roots: `M${w * 0.3} ${tuck} Q${w * 0.22} 46 ${w / 2} 60 Q${w * 0.78} 46 ${w * 0.7} ${tuck} Z`,
        };
    }
    return {
        crown: `M6 ${n} Q2 18 3 9 Q3 3 ${w * 0.2} 2 Q${w * 0.32} 6 ${w * 0.4} 3 Q${w / 2} 7 ${w * 0.6} 3 Q${w * 0.68} 6 ${w * 0.8} 2 Q${w - 3} 3 ${w - 3} 9 Q${w - 2} 18 ${w - 6} ${n} Q${w / 2} ${n + 1} 6 ${n} Z`,
        roots: `M5 ${tuck} Q${w * 0.06} 44 ${w * 0.2} 58 Q${w * 0.36} 46 ${w * 0.42} ${tuck} Z M${w * 0.58} ${tuck} Q${w * 0.64} 46 ${w * 0.8} 58 Q${w * 0.94} 44 ${w - 5} ${tuck} Z`,
    };
}

const ROW_WIDTH = UPPER.reduce((s, n) => s + toothWidth(n), 0) + GAP * (UPPER.length - 1);
const VIEW_W = ROW_WIDTH + 24;
const VIEW_H = 250;
const OCCLUSAL_Y = 120;

export function DentalChart({
    findings,
    mode = "clinical",
    selectedTooth = null,
    onToothSelect,
    onApply,
    disabled = false,
    pickerHint,
    showDetail = true,
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

    const onKey = (e: KeyboardEvent, n: string) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void activate(n);
        }
    };

    const renderRow = (teeth: string[], upper: boolean) => {
        let x = 12;
        return teeth.map((n, i) => {
            const w = toothWidth(n);
            const d = (i - 7.5) / 7.5; // -1 … 1 across the row
            const lift = ARCH_DIP * d * d;
            const baseY = upper ? 40 - lift : OCCLUSAL_Y + 4 + lift;
            const stateKey = findingToStatusKey(map.get(Number(n)));
            const { crown, roots } = toothPaths(n);
            const transform = upper ? `translate(${x} ${baseY + 70}) scale(1 -1)` : `translate(${x} ${baseY})`;
            const labelY = upper ? baseY - 8 : baseY + 88;
            const cx = x + w / 2;
            x += w + GAP;
            const label = formatDentalToothLabel(n, t);
            const isFocus = focusTooth === n;
            const cls = [
                "dental-arch__tooth",
                `is-${stateKey}`,
                isFocus ? "is-selected" : "",
                pulseTooth === n ? "is-pulse" : "",
            ]
                .filter(Boolean)
                .join(" ");
            return (
                <g
                    key={n}
                    className={cls}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-disabled={disabled || undefined}
                    aria-pressed={mode === "picker" ? isFocus : undefined}
                    aria-label={tp("dental.tooth_status_aria", { tooth: label, status: dentalStatusLabel(t, stateKey) })}
                    onClick={() => void activate(n)}
                    onKeyDown={(e) => onKey(e, n)}
                >
                    <g transform={transform}>
                        <path className="dental-arch__root" d={roots} />
                        <path className="dental-arch__crown" d={crown} />
                        {stateKey === "caries" ? <circle className="dental-arch__mark" cx={w / 2} cy={12} r={5} /> : null}
                        {stateKey === "filling" ? (
                            <rect className="dental-arch__mark" x={w * 0.28} y={7} width={w * 0.44} height={10} rx={5} />
                        ) : null}
                        {stateKey === "root" ? (
                            <path className="dental-arch__line" d={`M${w / 2 - 4} 38 L${w / 2 + 3} 46 L${w / 2 - 2} 54`} />
                        ) : null}
                        {stateKey === "implant" ? (
                            <path
                                className="dental-arch__line"
                                d={`M${w / 2 - 5} 36 H${w / 2 + 5} M${w / 2 - 4} 44 H${w / 2 + 4} M${w / 2 - 3} 52 H${w / 2 + 3} M${w / 2} 32 V60`}
                            />
                        ) : null}
                    </g>
                    <text className="dental-arch__num" x={cx} y={labelY} textAnchor="middle">
                        {label}
                    </text>
                </g>
            );
        });
    };

    const focusFindings = focusTooth ? findingsForTooth(findings, focusTooth) : [];
    const latest = focusFindings.length
        ? [...focusFindings].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0]
        : null;
    const focusState = focusTooth ? findingToStatusKey(map.get(Number(focusTooth))) : null;
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
                        {DENTAL_STATUS_KEYS.map((k) => (
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
                <svg
                    className="dental-arch__svg"
                    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                    role="group"
                    aria-label={hint}
                >
                    <g role="group" aria-label={t("dental.axis.top")}>
                        {renderRow(UPPER, true)}
                    </g>
                    <line className="dental-arch__occlusal" x1={12} x2={VIEW_W - 12} y1={OCCLUSAL_Y - 3} y2={OCCLUSAL_Y - 3} />
                    <line className="dental-arch__midline" x1={VIEW_W / 2} x2={VIEW_W / 2} y1={24} y2={VIEW_H - 24} />
                    <g role="group" aria-label={t("dental.axis.bottom")}>
                        {renderRow(LOWER, false)}
                    </g>
                </svg>
                <DentalOdontogramAxis slot="end">{t("dental.axis.left")}</DentalOdontogramAxis>
            </div>
            {showDetail ? (
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
