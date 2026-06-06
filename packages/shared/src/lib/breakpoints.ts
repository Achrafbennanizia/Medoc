/** Mirror of CSS custom properties on `:root` (`--bp-sm` …) for TS logic. */
export const BP_SM = 640;
export const BP_MD = 900;
export const BP_LG = 1200;

export const breakpoints = {
    sm: BP_SM,
    md: BP_MD,
    lg: BP_LG,
} as const;
