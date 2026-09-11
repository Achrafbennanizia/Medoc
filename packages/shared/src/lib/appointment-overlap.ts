/** Side-by-side lanes when appointments overlap on the day/week timeline. */

export type AppointmentTimelineSpan = {
    id: string;
    startMin: number;
    endMin: number;
};

export type AppointmentOverlapLane = {
    col: number;
    colCount: number;
};

export const APPOINTMENT_BLOCK_EDGE_PX = 4;
export const APPOINTMENT_OVERLAP_LANE_GAP_PX = 2;

/**
 * Assign side-by-side lanes for overlapping appointments (week/day calendar).
 * Non-overlapping items use a single full-width lane.
 */
export function assignAppointmentOverlapLanes(
    spans: readonly AppointmentTimelineSpan[],
): Map<string, AppointmentOverlapLane> {
    const sorted = [...spans].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id));
    const laneEnd: number[] = [];
    const provisional = new Map<string, number>();

    for (const span of sorted) {
        let col = laneEnd.findIndex((end) => end <= span.startMin);
        if (col < 0) {
            col = laneEnd.length;
            laneEnd.push(span.endMin);
        } else {
            laneEnd[col] = span.endMin;
        }
        provisional.set(span.id, col);
    }

    const byId = new Map(spans.map((s) => [s.id, s]));
    const parent = new Map<string, string>();
    const find = (id: string): string => {
        let p = parent.get(id) ?? id;
        while ((parent.get(p) ?? p) !== p) p = parent.get(p)!;
        parent.set(id, p);
        return p;
    };
    const union = (a: string, b: string) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
    };
    for (const id of provisional.keys()) parent.set(id, id);

    const ordered = sorted.map((s) => s.id);
    for (let i = 0; i < ordered.length; i++) {
        const a = byId.get(ordered[i]!)!;
        for (let j = i + 1; j < ordered.length; j++) {
            const b = byId.get(ordered[j]!)!;
            if (b.startMin >= a.endMin) break;
            if (a.startMin < b.endMin && b.startMin < a.endMin) union(a.id, b.id);
        }
    }

    const clusterMax = new Map<string, number>();
    for (const [id, col] of provisional) {
        const root = find(id);
        clusterMax.set(root, Math.max(clusterMax.get(root) ?? 0, col + 1));
    }

    const out = new Map<string, AppointmentOverlapLane>();
    for (const [id, col] of provisional) {
        out.set(id, { col, colCount: clusterMax.get(find(id)) ?? 1 });
    }
    return out;
}

/** Inline start/width for an overlap lane inside a day column. */
export function appointmentOverlapLaneInsets(
    lane: AppointmentOverlapLane,
    edgePx = APPOINTMENT_BLOCK_EDGE_PX,
    gapPx = APPOINTMENT_OVERLAP_LANE_GAP_PX,
): { insetInlineStart: string; width: string } {
    const { col, colCount } = lane;
    if (colCount <= 1) {
        return {
            insetInlineStart: `${edgePx}px`,
            width: `calc(100% - ${edgePx * 2}px)`,
        };
    }
    const inner = `100% - ${edgePx * 2}px - ${(colCount - 1) * gapPx}px`;
    return {
        insetInlineStart: `calc(${edgePx}px + ${col} * ((${inner}) / ${colCount} + ${gapPx}px))`,
        width: `calc((${inner}) / ${colCount})`,
    };
}
