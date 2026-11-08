function errorText(err: unknown): string {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
        return err.message;
    }
    return "";
}

/** Seconds until the next sign-in is allowed, from `error.app.rate_limited|seconds=N`. */
export function rateLimitSeconds(err: unknown): number | null {
    const raw = errorText(err);
    if (!/rate_limited/i.test(raw)) return null;
    const match = raw.match(/seconds=(\d+)/i);
    if (!match) return null;
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** `m:ss`, or `h:mm:ss` when the wait is an hour or longer. */
export function formatLockoutCountdown(totalSeconds: number): string {
    const total = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}
