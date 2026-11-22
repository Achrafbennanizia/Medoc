/** Small, pure formatters for the About & support page. */
import type { Tone } from "./about-status";

/** Pill colour class per status tone (primitives.css `.pill.*`). */
export const TONE_PILL: Record<Tone, string> = { ok: "green", warn: "yellow", problem: "red", unknown: "grey" };

/** Clock offset to the practice host, e.g. "+3 s", "−1 min 4 s". */
export function formatOffset(ms: number): string {
    const s = Math.round(ms / 1000);
    const sign = s < 0 ? "−" : "+";
    const abs = Math.abs(s);
    return abs >= 60 ? `${sign}${Math.floor(abs / 60)} min ${abs % 60} s` : `${sign}${abs} s`;
}

export function formatBytes(n: number): string {
    if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
}
