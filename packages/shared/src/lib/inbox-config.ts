/** FA-AUFG-03: polling interval on `/tickets` (practice tasks + tickets). */
export const INBOX_POLL_MS = 5_000;

/**
 * `/inbox`: the Solo guest inbox (proposals the admin adds or dismisses). Other editions keep
 * practice tasks on `/tickets` and `/inbox` redirects there.
 */
export const INBOX_UI_ENABLED: boolean = __CAP_GUEST_INBOX__;
