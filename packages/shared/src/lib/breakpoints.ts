/** Mirror of CSS custom properties on `:root` (`--bp-sm` …) for TS logic. */
export const BP_SM = 640;
export const BP_MD = 900;
export const BP_LG = 1200;

/** Default + minimum app viewport. */
export const APP_VIEWPORT_MIN_WIDTH = 1250;
export const APP_VIEWPORT_MIN_HEIGHT = 800;

export const breakpoints = {
    sm: BP_SM,
    md: BP_MD,
    lg: BP_LG,
    viewportMinWidth: APP_VIEWPORT_MIN_WIDTH,
    viewportMinHeight: APP_VIEWPORT_MIN_HEIGHT,
} as const;
