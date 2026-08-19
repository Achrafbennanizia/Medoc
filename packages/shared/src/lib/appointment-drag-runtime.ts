import { minutesToTime } from "./appointment-availability";

export type AppointmentDragColumnHit = {
    iso: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    height: number;
};

type GutterHit = {
    left: number;
    right: number;
    top: number;
    bottom: number;
    height: number;
};

type DragDomSession = {
    blockEl: HTMLButtonElement | null;
    ghostEl: HTMLDivElement | null;
    sourceId: string | null;
    highlightIso: string | null;
};

const dragSession: DragDomSession = {
    blockEl: null,
    ghostEl: null,
    sourceId: null,
    highlightIso: null,
};

let columnCache: AppointmentDragColumnHit[] = [];
let gutterCache: GutterHit[] = [];
let columnCacheAt = 0;
const COLUMN_CACHE_MS = 120;

export function bindAppointmentDragBlock(el: HTMLButtonElement | null): void {
    dragSession.blockEl = el;
}

/** Week view: floating ghost so the tile never unmounts/remounts across day columns. */
export function createAppointmentDragGhost(source: HTMLButtonElement, appointmentId: string): void {
    destroyAppointmentDragGhost();
    dragSession.sourceId = appointmentId;
    const r = source.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.setAttribute("data-appointment-drag-ghost", "1");
    ghost.className = `${source.className} appointment-appt-block--dragging appointment-appt-block--drag-ghost`;
    ghost.innerHTML = source.innerHTML;
    ghost.style.position = "fixed";
    ghost.style.left = "0";
    ghost.style.top = "0";
    ghost.style.width = `${r.width}px`;
    ghost.style.height = `${r.height}px`;
    ghost.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
    ghost.style.margin = "0";
    ghost.style.zIndex = "9999";
    ghost.style.pointerEvents = "none";
    ghost.style.boxSizing = "border-box";
    document.body.appendChild(ghost);
    dragSession.ghostEl = ghost;
    source.classList.add("appointment-appt-block--drag-source-hidden");
}

export function positionAppointmentDragGhost(
    col: AppointmentDragColumnHit,
    topPx: number,
    startMin: number,
    invalid: boolean,
): void {
    const el = dragSession.ghostEl;
    if (!el) return;
    const inset = 4;
    const left = col.left + inset;
    const top = col.top + topPx;
    const width = Math.max(40, col.right - col.left - inset * 2);
    el.style.width = `${width}px`;
    el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    const timeNode = el.querySelector<HTMLElement>(".appointment-appt-block-time");
    if (timeNode) {
        timeNode.textContent = minutesToTime(startMin).slice(0, 5);
        timeNode.classList.add("appointment-appt-block-time--drag-live");
    }
    el.classList.toggle("appointment-appt-block--drag-invalid", invalid);
    setAppointmentDragColumnHighlight(col.iso);
}

export function destroyAppointmentDragGhost(): void {
    dragSession.ghostEl?.remove();
    dragSession.ghostEl = null;
    if (dragSession.sourceId) {
        const source = document.querySelector<HTMLElement>(
            `[data-appointment-appt-id="${CSS.escape(dragSession.sourceId)}"]`,
        );
        source?.classList.remove("appointment-appt-block--drag-source-hidden");
    }
    dragSession.sourceId = null;
    setAppointmentDragColumnHighlight(null);
}

export function setAppointmentDragColumnHighlight(iso: string | null): void {
    if (dragSession.highlightIso === iso) return;
    if (dragSession.highlightIso) {
        const prev = document.querySelector<HTMLElement>(
            `[data-appointment-day-col="${CSS.escape(dragSession.highlightIso)}"]`,
        );
        prev?.classList.remove("appointment-day-col--drag-target");
    }
    dragSession.highlightIso = iso;
    if (!iso) return;
    const col = document.querySelector<HTMLElement>(`[data-appointment-day-col="${CSS.escape(iso)}"]`);
    col?.classList.add("appointment-day-col--drag-target");
}

export function clearAppointmentDragBlock(): void {
    const el = dragSession.blockEl;
    if (el) {
        el.style.removeProperty("--appointment-drag-top");
        el.classList.remove("appointment-appt-block--drag-invalid");
    }
    dragSession.blockEl = null;
}

export function clearAppointmentDragSession(): void {
    clearAppointmentDragBlock();
    destroyAppointmentDragGhost();
    setAppointmentDragNavEdge(null, null);
}

export type AppointmentDragCanvasEdge = "left" | "right" | null;

let navEdgeCanvas: HTMLElement | null = null;

/** Visual hint on week/day grid borders while dragging near an edge. */
export function setAppointmentDragNavEdge(canvas: HTMLElement | null, edge: AppointmentDragCanvasEdge): void {
    if (navEdgeCanvas && navEdgeCanvas !== canvas) {
        navEdgeCanvas.classList.remove("appointment-drag-nav-edge-left", "appointment-drag-nav-edge-right");
    }
    navEdgeCanvas = canvas;
    if (!canvas) return;
    canvas.classList.toggle("appointment-drag-nav-edge-left", edge === "left");
    canvas.classList.toggle("appointment-drag-nav-edge-right", edge === "right");
}

/** Pointer inside canvas vertical band and near left/right border (or just outside). */
export function detectCanvasDragEdge(
    clientX: number,
    clientY: number,
    rect: { top: number; bottom: number; left: number; right: number },
    edgePx: number,
): AppointmentDragCanvasEdge {
    if (clientY < rect.top || clientY > rect.bottom) return null;
    if (clientX <= rect.left + edgePx || clientX < rect.left) return "left";
    if (clientX >= rect.right - edgePx || clientX > rect.right) return "right";
    return null;
}

/** Week grid: canvas border or first/last day column border. */
export function detectWeekGridDragEdge(
    clientX: number,
    clientY: number,
    canvasRect: { top: number; bottom: number; left: number; right: number },
    edgePx: number,
): AppointmentDragCanvasEdge {
    refreshAppointmentDragColumnCache();
    const onCanvas = detectCanvasDragEdge(clientX, clientY, canvasRect, edgePx);
    if (onCanvas) return onCanvas;
    if (clientY < canvasRect.top || clientY > canvasRect.bottom) return null;
    const cols = [...columnCache].sort((a, b) => a.left - b.left);
    if (cols.length === 0) return null;
    const first = cols[0]!;
    const last = cols[cols.length - 1]!;
    if (clientY >= first.top && clientY <= first.bottom && clientX >= first.left && clientX <= first.left + edgePx) {
        return "left";
    }
    if (clientY >= last.top && clientY <= last.bottom && clientX >= last.right - edgePx && clientX <= last.right) {
        return "right";
    }
    return null;
}

export function paintAppointmentDragVisual(topPx: number, startMin: number, invalid: boolean): void {
    if (dragSession.ghostEl) {
        return;
    }
    const el = dragSession.blockEl;
    if (!el) return;
    el.style.setProperty("--appointment-drag-top", `${topPx}px`);
    const timeNode = el.querySelector<HTMLElement>(".appointment-appt-block-time");
    if (timeNode) {
        timeNode.textContent = minutesToTime(startMin).slice(0, 5);
        timeNode.classList.add("appointment-appt-block-time--drag-live");
    }
    el.classList.toggle("appointment-appt-block--drag-invalid", invalid);
}

export function paintAppointmentHourGutterSnap(topPx: number, startMin: number): void {
    const snap = document.querySelector<HTMLElement>(".appointment-hour-gutter-snap--drag");
    if (!snap) return;
    snap.style.top = `${topPx}px`;
    const label = snap.querySelector<HTMLElement>(".appointment-hour-gutter-snap__time");
    if (label) label.textContent = minutesToTime(startMin).slice(0, 5);
}

export function invalidateAppointmentDragColumnCache(): void {
    columnCacheAt = 0;
    columnCache = [];
    gutterCache = [];
}

function refreshAppointmentDragColumnCache(force = false): void {
    if (!force && Date.now() - columnCacheAt < COLUMN_CACHE_MS && columnCache.length > 0) return;
    columnCacheAt = Date.now();
    columnCache = [];
    gutterCache = [];
    for (const col of document.querySelectorAll<HTMLElement>("[data-appointment-day-col]")) {
        const iso = col.dataset.appointmentDayCol;
        if (!iso) continue;
        const r = col.getBoundingClientRect();
        columnCache.push({
            iso,
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            height: r.height,
        });
    }
    for (const g of document.querySelectorAll<HTMLElement>("[data-appointment-hour-gutter]")) {
        const r = g.getBoundingClientRect();
        gutterCache.push({
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            height: r.height,
        });
    }
}

export function listAppointmentDragColumns(): readonly AppointmentDragColumnHit[] {
    refreshAppointmentDragColumnCache();
    return columnCache;
}

export function pickAppointmentDragColumn(
    clientX: number,
    clientY: number,
): AppointmentDragColumnHit | null {
    refreshAppointmentDragColumnCache();
    const inBand = columnCache.filter((c) => clientY >= c.top && clientY <= c.bottom);
    if (inBand.length === 0) return null;
    for (const c of inBand) {
        if (clientX >= c.left && clientX <= c.right) return c;
    }
    let best = inBand[0]!;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const c of inBand) {
        const cx = (c.left + c.right) / 2;
        const d = Math.abs(clientX - cx);
        if (d < bestDist) {
            bestDist = d;
            best = c;
        }
    }
    return best;
}

export function hitAppointmentDragDayColumn(
    clientX: number,
    clientY: number,
): { iso: string; rect: AppointmentDragColumnHit } | null {
    refreshAppointmentDragColumnCache();
    for (const c of columnCache) {
        if (clientY < c.top || clientY > c.bottom) continue;
        if (clientX < c.left || clientX > c.right) continue;
        return { iso: c.iso, rect: c };
    }
    return null;
}

export function hitAppointmentDragHourGutter(clientX: number, clientY: number): GutterHit | null {
    refreshAppointmentDragColumnCache();
    for (const g of gutterCache) {
        if (clientX < g.left || clientX > g.right) continue;
        if (clientY < g.top || clientY > g.bottom) continue;
        return g;
    }
    return null;
}

export function findAppointmentDragColumnByIso(iso: string): AppointmentDragColumnHit | null {
    refreshAppointmentDragColumnCache();
    return columnCache.find((c) => c.iso === iso) ?? null;
}

export type AppointmentDragPatch = {
    currentDate: string;
    currentStartMin: number;
    dropAllowed: boolean;
};

export function appointmentDragPatchChanged(a: AppointmentDragPatch | null, b: AppointmentDragPatch): boolean {
    if (!a) return true;
    return a.currentDate !== b.currentDate || a.currentStartMin !== b.currentStartMin || a.dropAllowed !== b.dropAllowed;
}
