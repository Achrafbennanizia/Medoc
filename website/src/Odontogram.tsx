import { type KeyboardEvent, useState } from "react";
import type { Dict, Status } from "./i18n";

// FDI numbering, drawn from the viewer's side as on any dental chart:
// patient's right (quadrants 1 and 4) on the left. The chart never mirrors in RTL.
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Same model as the app: a tooth can carry several statuses at once (e.g. crown + caries).
export const FINDINGS: Record<number, Status[]> = {
  16: ["filling"],
  24: ["filling", "caries"],
  26: ["crown", "caries"],
  36: ["caries"],
  37: ["filling"],
  46: ["implant"],
  48: ["missing"],
  45: ["filling"],
};

/** Most urgent first: drives the "next step" line when a tooth has several statuses. */
const PRIORITY: Status[] = ["caries", "missing", "crown", "implant", "filling"];
const statusesOf = (n: number): Status[] =>
  FINDINGS[n] ? [...FINDINGS[n]].sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b)) : ["healthy"];

const LAST_VISIT: Partial<Record<Status, string>> = {
  caries: "2026-10-12",
  filling: "2025-03-04",
  crown: "2024-11-19",
  implant: "2025-06-23",
  missing: "2023-09-02",
};

function widthOf(n: number) {
  const k = n % 10;
  if (k <= 2) return 24;
  if (k === 3) return 26;
  if (k <= 5) return 28;
  return 36;
}

// Same smooth outlines as the app's chart: biting edge at y=0, roots toward +y (upper teeth are flipped).
function toothPath(w: number, kind: "incisor" | "canine" | "premolar" | "molar") {
  const n = 30;
  const tuck = n - 6;
  if (kind === "incisor")
    return {
      crown: `M6 ${n} Q2 18 3 8 Q4 2 9 2 H${w - 9} Q${w - 4} 2 ${w - 3} 8 Q${w - 2} 18 ${w - 6} ${n} Q${w / 2} ${n + 1} 6 ${n} Z`,
      roots: `M${w * 0.34} ${tuck} Q${w * 0.28} 46 ${w / 2} 58 Q${w * 0.72} 46 ${w * 0.66} ${tuck} Z`,
    };
  if (kind === "canine")
    return {
      crown: `M6 ${n} Q3 16 5 11 Q4 5 ${w * 0.34} 3 Q${w / 2} -1 ${w * 0.66} 3 Q${w - 4} 5 ${w - 5} 11 Q${w - 3} 16 ${w - 6} ${n} Q${w / 2} ${n + 1} 6 ${n} Z`,
      roots: `M${w * 0.32} ${tuck} Q${w * 0.24} 50 ${w / 2} 68 Q${w * 0.76} 50 ${w * 0.68} ${tuck} Z`,
    };
  if (kind === "premolar")
    return {
      crown: `M5 ${n} Q2 16 3 8 Q4 2 ${w * 0.3} 1.5 Q${w * 0.42} 5 ${w / 2} 3.5 Q${w * 0.58} 5 ${w * 0.7} 1.5 Q${w - 4} 2 ${w - 3} 8 Q${w - 2} 16 ${w - 5} ${n} Q${w / 2} ${n + 1} 5 ${n} Z`,
      roots: `M${w * 0.3} ${tuck} Q${w * 0.22} 46 ${w / 2} 60 Q${w * 0.78} 46 ${w * 0.7} ${tuck} Z`,
    };
  return {
    crown: `M6 ${n} Q2 18 3 9 Q3 3 ${w * 0.2} 2 Q${w * 0.32} 6 ${w * 0.4} 3 Q${w / 2} 7 ${w * 0.6} 3 Q${w * 0.68} 6 ${w * 0.8} 2 Q${w - 3} 3 ${w - 3} 9 Q${w - 2} 18 ${w - 6} ${n} Q${w / 2} ${n + 1} 6 ${n} Z`,
    roots: `M5 ${tuck} Q${w * 0.06} 44 ${w * 0.2} 58 Q${w * 0.36} 46 ${w * 0.42} ${tuck} Z M${w * 0.58} ${tuck} Q${w * 0.64} 46 ${w * 0.8} 58 Q${w * 0.94} 44 ${w - 5} ${tuck} Z`,
  };
}

function kindOf(n: number): "incisor" | "canine" | "premolar" | "molar" {
  const k = n % 10;
  if (k <= 2) return "incisor";
  if (k === 3) return "canine";
  if (k <= 5) return "premolar";
  return "molar";
}

type Props = { t: Dict; locale: string };

export function Odontogram({ t, locale }: Props) {
  const [selected, setSelected] = useState<number>(26);
  const statuses = statusesOf(selected);
  const status = statuses[0]!;
  const gap = 4;
  const rowWidth = UPPER.reduce((s, n) => s + widthOf(n), 0) + gap * (UPPER.length - 1);
  const W = rowWidth + 24;
  const H = 244;

  // Roving tabindex: one tab stop for the chart, arrow keys move between teeth.
  const move = (e: KeyboardEvent, n: number) => {
    const up = UPPER.indexOf(n);
    const row = up >= 0 ? UPPER : LOWER;
    const i = row.indexOf(n);
    let next: number | undefined;
    if (e.key === "ArrowRight") next = row[Math.min(i + 1, row.length - 1)];
    else if (e.key === "ArrowLeft") next = row[Math.max(i - 1, 0)];
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") next = (up >= 0 ? LOWER : UPPER)[i];
    else if (e.key === "Enter" || e.key === " ") next = n;
    if (next === undefined) return;
    e.preventDefault();
    setSelected(next);
    (e.currentTarget.closest("svg")?.querySelector(`[data-tooth="${next}"]`) as SVGGElement | null)?.focus();
  };

  const row = (teeth: number[], up: boolean) => {
    let x = 12;
    return teeth.map((n, i) => {
      const w = widthOf(n);
      const d = (i - 7.5) / 7.5; // -1..1
      const curve = 22 * d * d; // gentle arch
      const baseY = up ? 40 - curve : 124 + curve;
      const sts = statusesOf(n);
      const has = (k: Status) => sts.includes(k);
      const { crown, roots } = toothPath(w, kindOf(n));
      // For upper teeth the crown sits at the bottom (occlusal plane in the middle).
      const transform = up
        ? `translate(${x} ${baseY + 70}) scale(1 -1)`
        : `translate(${x} ${baseY})`;
      const labelY = up ? baseY - 8 : baseY + 88;
      const cx = x + w / 2;
      x += w + gap;
      const isSel = n === selected;
      return (
        <g
          key={n}
          className={`tooth ${sts.map((k) => `st-${k}`).join(" ")}${isSel ? " is-selected" : ""}${FINDINGS[n] ? " has-finding" : ""}`}
          style={{ ["--i" as string]: i }}
          data-tooth={n}
          role="button"
          tabIndex={isSel ? 0 : -1}
          aria-pressed={isSel}
          aria-label={`${t.hero.tooth} ${n}: ${sts.map((k) => t.status[k]).join(", ")}`}
          onClick={() => setSelected(n)}
          onKeyDown={(e) => move(e, n)}
        >
          <g transform={transform}>
            <path className="tooth-root" d={roots} />
            <path className="tooth-crown" d={crown} />
            {has("caries") && <circle className="tooth-mark tooth-mark--caries" cx={w / 2} cy={12} r={5} />}
            {has("filling") && (
              <rect className="tooth-mark tooth-mark--filling" x={w * 0.28} y={has("caries") ? 19 : 7} width={w * 0.44} height={has("caries") ? 7 : 10} rx={has("caries") ? 3.5 : 5} />
            )}
            {has("implant") && (
              <path className="tooth-screw" d={`M${w / 2 - 5} 36 H${w / 2 + 5} M${w / 2 - 4} 44 H${w / 2 + 4} M${w / 2 - 3} 52 H${w / 2 + 3} M${w / 2} 32 V60`} />
            )}
          </g>
          <text className="tooth-num" x={cx} y={labelY} textAnchor="middle">
            {n}
          </text>
        </g>
      );
    });
  };

  const visit = LAST_VISIT[status];
  const fmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="chart">
      <div className="chart-head">
        <div>
          <p className="chart-title">{t.hero.chartTitle}</p>
          <p className="chart-patient">{t.hero.chartPatient}</p>
        </div>
        <ul className="chart-legend" aria-label={t.hero.chartTitle}>
          {(["caries", "filling", "crown", "implant", "missing"] as Status[]).map((s) => (
            <li key={s}>
              <span className={`swatch sw-${s}`} aria-hidden />
              {t.status[s]}
            </li>
          ))}
        </ul>
      </div>
      <div className="chart-svg" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t.hero.chartHint}>
          <g role="group" aria-label={t.hero.upper}>
            {row(UPPER, true)}
          </g>
          <line className="occlusal" x1={12} x2={W - 12} y1={117} y2={117} />
          <line className="occlusal" x1={W / 2} x2={W / 2} y1={24} y2={H - 24} />
          <g role="group" aria-label={t.hero.lower}>
            {row(LOWER, false)}
          </g>
        </svg>
      </div>
      <div className="chart-detail" aria-live="polite">
        <p className="chart-tooth">
          <span className="chart-tooth-n">{selected}</span>
          <span className="chart-pills">
            {statuses.map((k) => (
              <span key={k} className={`pill pill-${k}`}>
                {t.status[k]}
              </span>
            ))}
          </span>
        </p>
        <p className="chart-note">{statuses.map((k) => t.notes[k]).join(" ")}</p>
        <dl className="chart-meta">
          {visit && (
            <div>
              <dt>{t.hero.lastVisit}</dt>
              <dd>{fmt.format(new Date(visit))}</dd>
            </div>
          )}
          <div>
            <dt>{t.hero.next}</dt>
            <dd>{t.nextStep[status]}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
