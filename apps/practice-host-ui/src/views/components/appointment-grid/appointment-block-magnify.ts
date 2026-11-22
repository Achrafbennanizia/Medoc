/**
 * Hover magnify for an appointment block. On hover the block grows to its detail size
 * (`--appointment-magnify-min-h` × `--appointment-magnify-min-w`, so the container queries show every
 * line) and scales by `--appointment-card-hover-scale`. This computes the shift that keeps the
 * enlarged block inside the calendar; leaving the block clears it so it returns to its own size.
 */

const PANEL_SELECTORS = [".appointment-week-body-grid", ".appointment-day-timeline-host", ".appointment-day-col"];
const EDGE_GAP_PX = 4;

function cssPx(el: Element, name: string, fallback: number): number {
    const v = Number.parseFloat(getComputedStyle(el).getPropertyValue(name).trim());
    return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function placeAppointmentMagnify(el: HTMLElement): void {
    el.classList.add("appointment-appt-block--hover-front");
    const panel = PANEL_SELECTORS.map((s) => el.closest<HTMLElement>(s)).find(Boolean);
    if (!panel) return;
    const bound = panel.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const scale = Math.max(1, cssPx(document.documentElement, "--appointment-card-hover-scale", 1.12));
    const w = Math.max(r.width, cssPx(el, "--appointment-magnify-min-w", 216)) * scale;
    const h = Math.max(r.height, cssPx(el, "--appointment-magnify-min-h", 104)) * scale;
    const rtl = getComputedStyle(el).direction === "rtl";
    // Grows from the top start corner; pull it back where it would leave the calendar.
    const shiftY = Math.min(0, bound.bottom - EDGE_GAP_PX - (r.top + h));
    const shiftX = rtl
        ? Math.max(0, bound.left + EDGE_GAP_PX - (r.right - w))
        : Math.min(0, bound.right - EDGE_GAP_PX - (r.left + w));
    el.style.setProperty("--appointment-magnify-shift-x", `${Math.round(shiftX)}px`);
    el.style.setProperty("--appointment-magnify-shift-y", `${Math.round(shiftY)}px`);
}

export function clearAppointmentMagnify(el: HTMLElement): void {
    el.classList.remove("appointment-appt-block--hover-front");
    el.style.removeProperty("--appointment-magnify-shift-x");
    el.style.removeProperty("--appointment-magnify-shift-y");
}
