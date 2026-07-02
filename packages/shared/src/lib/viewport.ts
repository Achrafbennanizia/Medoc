/**
 * Default / minimum application viewport (measured from dashboard baseline screenshot, 2026-07-02).
 * Keep in sync with `--app-viewport-*` in `apps/practice-host-ui/src/index.css` and `tauri.conf.json`.
 */
export const APP_VIEWPORT_WIDTH = 1024;
export const APP_VIEWPORT_HEIGHT = 681;

export const APP_VIEWPORT_MIN_WIDTH = APP_VIEWPORT_WIDTH;
export const APP_VIEWPORT_MIN_HEIGHT = APP_VIEWPORT_HEIGHT;

export const appViewport = {
    width: APP_VIEWPORT_WIDTH,
    height: APP_VIEWPORT_HEIGHT,
    minWidth: APP_VIEWPORT_MIN_WIDTH,
    minHeight: APP_VIEWPORT_MIN_HEIGHT,
} as const;
