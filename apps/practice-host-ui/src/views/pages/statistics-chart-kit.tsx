/** Axis tick and bar label renderers of the statistics charts (split from `statistics.tsx`). */
import { formatWorkMinutes } from "@/lib/work-time-ui";
import { CHART_TICK, XHTML_NS, numProp } from "./statistics-chart-style";

/** SVG <text> cannot render Arabic correctly under html[dir=rtl]. HTML ticks do. */
export function ChartAxisTick({
    x = 0,
    y = 0,
    payload,
    fill = CHART_TICK,
    fontSize = 11,
    axis = "x",
    forceDir,
    ySide = "left",
    tickWidth,
}: {
    x?: number;
    y?: number;
    payload?: { value?: string | number };
    fill?: string;
    fontSize?: number;
    axis?: "x" | "y";
    forceDir?: "ltr" | "rtl";
    ySide?: "left" | "right";
    tickWidth?: number;
}) {
    const raw = String(payload?.value ?? "");
    const arabic = /[\u0600-\u06FF]/.test(raw);
    const dir = forceDir ?? (arabic ? "rtl" : "ltr");
    if (axis === "y") {
        const w = tickWidth ?? Math.min(96, Math.max(64, raw.length * 7));
        const h = 20;
        const foX = ySide === "right" ? 6 : -w - 6;
        return (
            <g transform={`translate(${x},${y})`}>
                <foreignObject x={foX} y={-h / 2} width={w} height={h}>
                    <div
                        {...XHTML_NS}
                        title={raw}
                        style={{
                            width: "100%",
                            textAlign: ySide === "right" ? "start" : "end",
                            fontSize,
                            color: fill,
                            lineHeight: "1.2",
                            direction: dir,
                            unicodeBidi: "isolate",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {raw}
                    </div>
                </foreignObject>
            </g>
        );
    }
    const w = Math.min(108, Math.max(52, raw.length * 9));
    return (
        <g transform={`translate(${x},${y})`}>
            <foreignObject x={-w / 2} y={2} width={w} height={32}>
                <div
                    {...XHTML_NS}
                    style={{
                        width: "100%",
                        textAlign: "center",
                        fontSize,
                        color: fill,
                        lineHeight: "1.25",
                        direction: dir,
                        unicodeBidi: "isolate",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                    }}
                >
                    {raw}
                </div>
            </foreignObject>
        </g>
    );
}

export function ChartBarTopLabel({
    x = 0,
    y = 0,
    width = 0,
    value,
}: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: number | string;
}) {
    const nx = numProp(x);
    const ny = numProp(y);
    const nw = numProp(width);
    const nv = numProp(value, NaN);
    if (!Number.isFinite(nv) || nv <= 0) return null;
    const raw = formatWorkMinutes(nv, { compact: true });
    const w = Math.min(88, Math.max(56, raw.length * 7));
    const arabic = /[\u0600-\u06FF]/.test(raw);
    return (
        <foreignObject x={nx + nw / 2 - w / 2} y={ny - 18} width={w} height={16}>
            <div
                {...XHTML_NS}
                style={{
                    width: "100%",
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 650,
                    color: "var(--fg)",
                    direction: arabic ? "rtl" : "ltr",
                    unicodeBidi: "isolate",
                    whiteSpace: "nowrap",
                }}
            >
                {raw}
            </div>
        </foreignObject>
    );
}
