import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Behandlung, Zahnbefund } from "@/models/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
    DENTAL_LOWER_L,
    DENTAL_LOWER_R,
    DENTAL_STATES,
    DENTAL_TOOTH_SHAPES,
    DENTAL_UPPER_L,
    DENTAL_UPPER_R,
    type DentalStatusKey,
    befundToStatusKey,
    befundeForTooth,
    behandlungenForTooth,
    dentalToothType,
} from "@/lib/dental";

type PopState = {
    fdi: string;
    /** Anchor centre X (clientX coordinate, viewport relative). */
    centerX: number;
    /** Anchor top Y (clientY of the bounding rect top). */
    anchorTop: number;
    /** Anchor bottom Y (clientY of the bounding rect bottom). */
    anchorBottom: number;
};

type DentalMiniBarProps = {
    befunde: Zahnbefund[];
    behandlungen: Behandlung[];
    /** When false, render nothing (e.g. non-clinical role). */
    visible?: boolean;
};

/**
 * Compact two-row FDI odontogram for patient header.
 * Hover shows diagnoses (Zahnbefunde) and treatments (Behandlungen) for that tooth.
 */
export function DentalMiniBar({ befunde, behandlungen, visible = true }: DentalMiniBarProps) {
    const [pop, setPop] = useState<PopState | null>(null);
    const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
    const [vh, setVh] = useState(() => (typeof window === "undefined" ? 768 : window.innerHeight));
    const leaveTimer = useRef<number | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const onResize = () => {
            setVw(window.innerWidth);
            setVh(window.innerHeight);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const clearLeave = () => {
        if (leaveTimer.current != null) {
            window.clearTimeout(leaveTimer.current);
            leaveTimer.current = null;
        }
    };

    const scheduleClose = () => {
        clearLeave();
        leaveTimer.current = window.setTimeout(() => setPop(null), 220);
    };

    const openAt = useCallback((fdi: string, el: HTMLElement) => {
        clearLeave();
        const r = el.getBoundingClientRect();
        setPop({
            fdi,
            centerX: r.left + r.width / 2,
            anchorTop: r.top,
            anchorBottom: r.bottom,
        });
    }, []);

    const map = useMemo(() => {
        const m = new Map<number, string>();
        befunde.forEach((b) => m.set(b.zahn_nummer, b.befund));
        return m;
    }, [befunde]);

    const popBefunde = pop ? befundeForTooth(befunde, pop.fdi) : [];
    const popBehand = pop ? behandlungenForTooth(behandlungen, pop.fdi) : [];
    const popStatus: DentalStatusKey = pop ? befundToStatusKey(map.get(Number(pop.fdi))) : "healthy";
    const popLayout = useMemo(() => {
        if (!pop) return { left: 0, top: 0, width: 280, maxHeight: 360, placement: "below" as const };
        const safety = 12; // outer margin to the viewport edges
        const gap = 8; // distance between anchor and popover
        const desiredW = 320;
        const minW = 220;
        const availW = Math.max(minW, vw - 2 * safety);
        const width = Math.min(desiredW, availW);
        const desiredLeft = pop.centerX - width / 2;
        const minLeft = safety;
        const maxLeft = Math.max(minLeft, vw - width - safety);
        const left = Math.min(maxLeft, Math.max(minLeft, desiredLeft));
        // Decide vertical placement: prefer below; flip above when crowded.
        const spaceBelow = Math.max(0, vh - pop.anchorBottom - safety - gap);
        const spaceAbove = Math.max(0, pop.anchorTop - safety - gap);
        const placement = spaceBelow >= 200 || spaceBelow >= spaceAbove ? ("below" as const) : ("above" as const);
        const maxHeight = placement === "below" ? Math.max(160, spaceBelow) : Math.max(160, spaceAbove);
        const top = placement === "below" ? pop.anchorBottom + gap : Math.max(safety, pop.anchorTop - gap);
        return { left, top, width, maxHeight, placement };
    }, [pop, vw, vh]);

    if (!visible) return null;

    const renderMini = (fdi: string) => {
        const type = dentalToothType(fdi);
        const shape = DENTAL_TOOTH_SHAPES[type];
        const stateKey = befundToStatusKey(map.get(Number(fdi)));
        const st = DENTAL_STATES[stateKey];
        const hasHistory = befundeForTooth(befunde, fdi).length > 0 || behandlungenForTooth(behandlungen, fdi).length > 0;
        return (
            <div
                key={fdi}
                className="dental-mini-tooth-wrap"
                onMouseEnter={(e) => openAt(fdi, e.currentTarget)}
                onMouseLeave={scheduleClose}
            >
                <button
                    type="button"
                    className={`dental-mini-tooth ${hasHistory ? "has-history" : ""} ${pop?.fdi === fdi ? "is-active" : ""}`}
                    aria-label={`Zahn ${fdi}, ${st.label}`}
                >
                    <svg width="16" height="26" viewBox="0 0 20 34" aria-hidden>
                        <path d={shape.crown} fill={st.fill} stroke={st.stroke} strokeWidth={1.1} />
                        <path d={shape.root} fill={st.fill} stroke={st.stroke} strokeWidth={1.1} />
                    </svg>
                    <span className="dental-mini-label">{fdi}</span>
                </button>
            </div>
        );
    };

    const popoverNode = pop ? (
        <div
            className={`tooth-popover ${popLayout.placement === "above" ? "is-above" : ""}`}
            style={{
                left: popLayout.left,
                top: popLayout.top,
                width: popLayout.width,
                maxHeight: popLayout.maxHeight,
                transform: popLayout.placement === "above" ? "translateY(-100%)" : undefined,
            }}
            onMouseEnter={clearLeave}
            onMouseLeave={scheduleClose}
            role="tooltip"
        >
            <div className="tooth-popover-title">Zahn {pop.fdi}</div>
            <div className="tooth-popover-meta">{DENTAL_STATES[popStatus].label}</div>
            <div className="tooth-popover-section">
                <div className="tooth-popover-h">Befunde / Diagnosen</div>
                {popBefunde.length === 0 ? (
                    <div className="tooth-popover-empty">Keine erfassten Befunde.</div>
                ) : (
                    <ul className="tooth-popover-list">
                        {popBefunde.map((b) => (
                            <li key={b.id}>
                                <span className="tooth-popover-pill">{b.befund}</span>
                                {b.diagnose ? <span className="tooth-popover-sub">{b.diagnose}</span> : null}
                                {b.notizen ? <span className="tooth-popover-sub">{b.notizen}</span> : null}
                                <span className="tooth-popover-date">{formatDateTime(b.created_at)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="tooth-popover-section">
                <div className="tooth-popover-h">Behandlungen</div>
                {popBehand.length === 0 ? (
                    <div className="tooth-popover-empty">Keine Behandlungen zu diesem Zahn.</div>
                ) : (
                    <ul className="tooth-popover-list">
                        {popBehand.map((b) => (
                            <li key={b.id}>
                                <strong>{b.leistungsname || b.art}</strong>
                                {b.kategorie ? <span className="tooth-popover-sub">{b.kategorie}</span> : null}
                                <span className="tooth-popover-date">
                                    {b.behandlung_datum ? formatDate(b.behandlung_datum) : formatDateTime(b.created_at)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    ) : null;

    return (
        <div className="dental-mini-bar" onMouseLeave={scheduleClose}>
            <div className="dental-mini-bar-inner">
                <span className="dental-mini-title">Zahnstatus</span>
                <div className="dental-mini-row">{DENTAL_UPPER_R.map(renderMini)}{DENTAL_UPPER_L.map(renderMini)}</div>
                <div className="dental-mini-divider" />
                <div className="dental-mini-row">{DENTAL_LOWER_R.map(renderMini)}{DENTAL_LOWER_L.map(renderMini)}</div>
            </div>
            {/* Popover is portaled to <body> so that ancestors with `transform`
                (e.g. `.animate-fade-in` keyframes) cannot turn it into a
                containing block and clip it inside the page card. */}
            {popoverNode && typeof document !== "undefined"
                ? createPortal(popoverNode, document.body)
                : null}
        </div>
    );
}
