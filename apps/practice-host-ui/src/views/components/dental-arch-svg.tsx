import type { KeyboardEvent, MouseEvent } from "react";
import {
    DENTAL_LOWER_L,
    DENTAL_LOWER_R,
    DENTAL_UPPER_L,
    DENTAL_UPPER_R,
    type DentalStatusKey,
    findingToStatusKeys,
    dentalStatusLabel,
    dentalToothType,
    formatDentalToothLabel,
} from "@/lib/dental";
import { useT, useTParams } from "@/lib/i18n";

const UPPER = [...DENTAL_UPPER_R, ...DENTAL_UPPER_L];
const LOWER = [...DENTAL_LOWER_R, ...DENTAL_LOWER_L];

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

/** Crown + roots drawn with the biting edge at y=0 and the roots toward +y (Cursor's smooth outlines). Upper teeth are flipped by the caller. */
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

/**
 * One tooth with its marks, drawn in tooth space (biting edge at y=0, roots toward +y).
 * Each status owns one layer, so statuses stack instead of hiding each other:
 * crown colour (CSS, `is-*` on the parent), decay dot, filling block, root zigzag, implant screw,
 * dashed outline for planned, dashed ghost for missing. The rules for what may stack are in
 * `toggleDentalStatus`; the colours are in dental-arch.css.
 */
function ToothShape({ fdi, keys }: { fdi: string; keys: readonly DentalStatusKey[] }) {
    const w = toothWidth(fdi);
    const has = (k: DentalStatusKey) => keys.includes(k);
    const { crown, roots } = toothPaths(fdi);
    return (
        <>
            <path className="dental-arch__root" d={roots} />
            <path className="dental-arch__crown" d={crown} />
            {has("caries") ? <circle className="dental-arch__mark dental-arch__mark--caries" cx={w / 2} cy={12} r={5} /> : null}
            {has("filling") ? (
                <rect
                    className="dental-arch__mark dental-arch__mark--filling"
                    x={w * 0.28}
                    y={has("caries") ? 19 : 7}
                    width={w * 0.44}
                    height={has("caries") ? 7 : 10}
                    rx={has("caries") ? 3.5 : 5}
                />
            ) : null}
            {has("root") ? <path className="dental-arch__line dental-arch__line--root" d={`M${w / 2 - 4} 38 L${w / 2 + 3} 46 L${w / 2 - 2} 54`} /> : null}
            {has("implant") ? (
                <path
                    className="dental-arch__line dental-arch__line--implant"
                    d={`M${w / 2 - 5} 36 H${w / 2 + 5} M${w / 2 - 4} 44 H${w / 2 + 4} M${w / 2 - 3} 52 H${w / 2 + 3} M${w / 2} 32 V60`}
                />
            ) : null}
        </>
    );
}

/** CSS classes of a tooth group (one `is-*` per status). */
function toothClassName(keys: readonly DentalStatusKey[], extra: string[] = []): string {
    return ["dental-arch__tooth", ...keys.map((k) => `is-${k}`), ...extra].filter(Boolean).join(" ");
}

export type DentalArchToothIconProps = {
    fdi: string;
    keys: readonly DentalStatusKey[];
    /** Rendered height in px (width follows the tooth). */
    height?: number;
    selected?: boolean;
    pulse?: boolean;
};

/** A single tooth exactly as the chart draws it (Help, legends). Decorative: label it beside. */
export function DentalArchToothIcon({ fdi, keys, height = 44, selected = false, pulse = false }: DentalArchToothIconProps) {
    const w = toothWidth(fdi);
    const viewW = w + 6;
    const viewH = 74;
    return (
        <svg
            className="dental-arch__icon"
            viewBox={`-3 -4 ${viewW} ${viewH}`}
            width={(height * viewW) / viewH}
            height={height}
            aria-hidden
            focusable="false"
        >
            <g className={toothClassName(keys, [selected ? "is-selected" : "", pulse ? "is-pulse" : ""])}>
                <ToothShape fdi={fdi} keys={keys} />
            </g>
        </svg>
    );
}

const ROW_WIDTH = UPPER.reduce((s, n) => s + toothWidth(n), 0) + GAP * (UPPER.length - 1);
const VIEW_W = ROW_WIDTH + 24;
const VIEW_H = 250;
const OCCLUSAL_Y = 120;

export type DentalArchSvgProps = {
    /** tooth number → stored finding text (may hold combined statuses, e.g. "crown,caries"). */
    findings: Map<number, string>;
    isSelected?: (fdi: string) => boolean;
    /** Click / Enter / Space on a tooth. Omit for a view-only chart. */
    onActivate?: (fdi: string) => void;
    disabled?: boolean;
    pulseTooth?: string | null;
    /** Extra class per tooth, e.g. "has-history". */
    toothClass?: (fdi: string) => string;
    onToothEnter?: (fdi: string, el: Element) => void;
    onToothLeave?: () => void;
    /** Accessible name of the whole chart. */
    label: string;
    className?: string;
};

/** The arch odontogram drawing shared by the clinical chart, the header mini chart and the appointment picker. */
export function DentalArchSvg({
    findings,
    isSelected,
    onActivate,
    disabled = false,
    pulseTooth = null,
    toothClass,
    onToothEnter,
    onToothLeave,
    label,
    className,
}: DentalArchSvgProps) {
    const t = useT();
    const tp = useTParams();
    const interactive = Boolean(onActivate) && !disabled;

    const onKey = (e: KeyboardEvent, n: string) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate?.(n);
        }
    };

    const renderRow = (teeth: string[], upper: boolean) => {
        let x = 12;
        return teeth.map((n, i) => {
            const w = toothWidth(n);
            const d = (i - 7.5) / 7.5; // -1 … 1 across the row
            const lift = ARCH_DIP * d * d;
            const baseY = upper ? 40 - lift : OCCLUSAL_Y + 4 + lift;
            const keys: DentalStatusKey[] = findingToStatusKeys(findings.get(Number(n)));
            const transform = upper ? `translate(${x} ${baseY + 70}) scale(1 -1)` : `translate(${x} ${baseY})`;
            const labelY = upper ? baseY - 8 : baseY + 88;
            const cx = x + w / 2;
            x += w + GAP;
            const toothLabel = formatDentalToothLabel(n, t);
            const selected = isSelected?.(n) ?? false;
            const cls = toothClassName(keys, [selected ? "is-selected" : "", pulseTooth === n ? "is-pulse" : "", toothClass?.(n) ?? ""]);
            return (
                <g
                    key={n}
                    className={cls}
                    role={interactive ? "button" : "img"}
                    tabIndex={interactive ? 0 : undefined}
                    aria-pressed={interactive && isSelected ? selected : undefined}
                    aria-label={tp("dental.tooth_status_aria", { tooth: toothLabel, status: keys.map((k) => dentalStatusLabel(t, k)).join(", ") })}
                    onClick={interactive ? () => onActivate?.(n) : undefined}
                    onKeyDown={interactive ? (e) => onKey(e, n) : undefined}
                    onMouseEnter={onToothEnter ? (e: MouseEvent<SVGGElement>) => onToothEnter(n, e.currentTarget) : undefined}
                    onMouseLeave={onToothLeave}
                >
                    <g transform={transform}>
                        <ToothShape fdi={n} keys={keys} />
                    </g>
                    <text className="dental-arch__num" x={cx} y={labelY} textAnchor="middle">
                        {toothLabel}
                    </text>
                </g>
            );
        });
    };

    return (
        <svg className={`dental-arch__svg${className ? ` ${className}` : ""}`} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="group" aria-label={label}>
            <g role="group" aria-label={t("dental.axis.top")}>
                {renderRow(UPPER, true)}
            </g>
            <line className="dental-arch__occlusal" x1={12} x2={VIEW_W - 12} y1={OCCLUSAL_Y - 3} y2={OCCLUSAL_Y - 3} />
            <line className="dental-arch__midline" x1={VIEW_W / 2} x2={VIEW_W / 2} y1={24} y2={VIEW_H - 24} />
            <g role="group" aria-label={t("dental.axis.bottom")}>
                {renderRow(LOWER, false)}
            </g>
        </svg>
    );
}
