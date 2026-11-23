/** Compact tooth glyph. `marks` stacks effects (caries dot + filling block, and so on). */
import {
    DENTAL_STATES,
    DENTAL_TOOTH_SHAPES,
    type DentalStatusKey,
    dentalToothType,
} from "@/lib/dental";

const PAINT_ORDER: DentalStatusKey[] = ["missing", "crown", "implant", "filling", "caries", "root", "planned", "healthy"];

function paintKey(marks: DentalStatusKey[]): DentalStatusKey {
    if (marks.includes("missing")) return "missing";
    for (const key of PAINT_ORDER) {
        if (marks.includes(key)) return key;
    }
    return "healthy";
}

export function DentalMiniToothSvg({
    fdi,
    stateKey,
    marks,
    selected = false,
    width = 18,
    height = 28,
}: {
    fdi: string;
    stateKey: DentalStatusKey;
    /** When set, every mark is drawn together. `stateKey` is the fallback. */
    marks?: DentalStatusKey[];
    selected?: boolean;
    width?: number;
    height?: number;
}) {
    const shape = DENTAL_TOOTH_SHAPES[dentalToothType(fdi)];
    const active = marks && marks.length > 0 ? marks : [stateKey];
    const paint = paintKey(active);
    const st = DENTAL_STATES[paint];
    const sw = selected ? 1.8 : 1.1;
    const show = (key: DentalStatusKey) => active.includes(key) && !active.includes("missing");
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 20 34"
            aria-hidden
            className={`dental-mini-tooth-svg is-${paint}${show("planned") ? " is-planned" : ""}`}
        >
            <path className="dental-mini-tooth-svg__crown" d={shape.crown} fill={st.fill} stroke={st.stroke} strokeWidth={sw} />
            <path className="dental-mini-tooth-svg__root" d={shape.root} fill={st.fill} stroke={st.stroke} strokeWidth={sw} />
            {show("crown") ? (
                <path d="M4 6 H16" fill="none" stroke={DENTAL_STATES.crown.stroke} strokeWidth={1.3} strokeLinecap="round" />
            ) : null}
            {show("caries") ? <circle cx={10} cy={9} r={2.2} fill={DENTAL_STATES.caries.stroke} /> : null}
            {show("filling") ? <rect x={5.5} y={12} width={9} height={4} rx={1.2} fill={DENTAL_STATES.filling.stroke} /> : null}
            {show("root") ? (
                <path d="M6 22 L9 27 L7 31" fill="none" stroke={DENTAL_STATES.root.stroke} strokeWidth={1.4} strokeLinecap="round" />
            ) : null}
            {show("implant") ? (
                <path d="M11 20 H15 M12 24 H14 M13 18 V30" fill="none" stroke={DENTAL_STATES.implant.stroke} strokeWidth={1.2} strokeLinecap="round" />
            ) : null}
        </svg>
    );
}
