/**
 * Zahlenwerte für TS/React — visuelle Grundlage ist `index.css` (`:root`, `.icon-btn`, `.btn`, …).
 * Dialogradius = `--radius-card` (16px); Abweichungen nur mit triftigem Grund.
 */
export const INTERACTION_STANDARD = {
    control: {
        iconButtonSize: 34,
        compactIconButtonSize: 28,
        inputHeight: 36,
    },
    dropdown: {
        width: 260,
        radius: 14,
        itemHeight: 36,
        zIndex: 40,
    },
    dialog: {
        width: 420,
        maxWidthViewport: 92,
        radius: 16,
    },
} as const;

export type InteractionStandard = typeof INTERACTION_STANDARD;
