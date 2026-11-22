/** Pure helpers for content-based table column width estimates. */

export type ColumnWidthEstimateInput = {
    /** Header label width in px (already measured). */
    headerPx: number;
    /** Sampled body cell widths in px. */
    cellWidthsPx: number[];
};

export type ColumnWidthEstimateOptions = {
    /** Horizontal cell padding (both sides). Default 28 (14×2). */
    paddingPx?: number;
    /** Minimum share of available width for a column (px). */
    minPx?: number;
};

/**
 * Content weight for one column: max(header, avg cells) + padding.
 * Used as a share of the table's available width.
 */
export function columnContentWeightPx(
    input: ColumnWidthEstimateInput,
    opts: ColumnWidthEstimateOptions = {},
): number {
    const padding = opts.paddingPx ?? 28;
    const minPx = opts.minPx ?? 48;
    const cells = input.cellWidthsPx.filter((w) => Number.isFinite(w) && w >= 0);
    const avg =
        cells.length === 0 ? 0 : cells.reduce((sum, w) => sum + w, 0) / cells.length;
    const content = Math.max(input.headerPx, avg);
    return Math.max(minPx, content + padding);
}

/**
 * Distribute `availablePx` across columns proportional to content weights.
 * Widths always sum to `availablePx` so the table fills its container.
 */
export function distributeColumnWidthsPx(
    columns: ColumnWidthEstimateInput[],
    availablePx: number,
    opts: ColumnWidthEstimateOptions = {},
): number[] {
    const n = columns.length;
    if (n === 0) return [];
    const avail = Math.max(0, Math.floor(availablePx));
    if (avail === 0) return columns.map(() => 0);

    const minPx = opts.minPx ?? 48;
    const weights = columns.map((col) => columnContentWeightPx(col, opts));
    const weightSum = weights.reduce((a, b) => a + b, 0) || n;

    // First pass: proportional share, floored.
    const widths = weights.map((w) => Math.floor((avail * w) / weightSum));

    // Enforce min when possible; shrink oversized columns afterward.
    let assigned = widths.reduce((a, b) => a + b, 0);
    let deficit = avail - assigned;

    // Give leftover pixels to the largest-weight columns first.
    const order = weights
        .map((w, i) => ({ w, i }))
        .sort((a, b) => b.w - a.w || a.i - b.i);
    let oi = 0;
    while (deficit > 0 && n > 0) {
        widths[order[oi % n]!.i]! += 1;
        deficit -= 1;
        oi += 1;
    }

    // Raise columns below minPx by taking from columns above min.
    for (let i = 0; i < n; i++) {
        if (widths[i]! >= minPx) continue;
        let need = minPx - widths[i]!;
        for (let j = 0; j < n && need > 0; j++) {
            if (j === i) continue;
            const spare = widths[j]! - minPx;
            if (spare <= 0) continue;
            const take = Math.min(spare, need);
            widths[j]! -= take;
            widths[i]! += take;
            need -= take;
        }
    }

    // Final normalize so sum === avail (rounding drift).
    assigned = widths.reduce((a, b) => a + b, 0);
    let drift = avail - assigned;
    if (drift !== 0 && n > 0) {
        const target = order[0]!.i;
        widths[target] = Math.max(1, widths[target]! + drift);
    }

    return widths;
}

/** @deprecated Prefer distributeColumnWidthsPx with available container width. */
export function estimateColumnWidthPx(
    input: ColumnWidthEstimateInput,
    opts: ColumnWidthEstimateOptions & { maxPx?: number } = {},
): number {
    const padding = opts.paddingPx ?? 28;
    const minPx = opts.minPx ?? 48;
    const maxPx = opts.maxPx ?? 420;
    return Math.min(maxPx, columnContentWeightPx(input, { paddingPx: padding, minPx }));
}

/** @deprecated Prefer distributeColumnWidthsPx. */
export function estimateAllColumnWidthsPx(
    columns: ColumnWidthEstimateInput[],
    opts?: ColumnWidthEstimateOptions & { maxPx?: number },
): number[] {
    return columns.map((col) => estimateColumnWidthPx(col, opts));
}
