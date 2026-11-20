/**
 * Practice clock — the ONE source of "now", "today" and timestamp parsing for the UI.
 *
 * Why this exists (bug class it removes):
 * 1. `new Date().toISOString().slice(0, 10)` returns the **UTC** date. In Germany (UTC+1/+2) that is
 *    *yesterday* between 00:00 and 01:00/02:00 local, so "today" defaults, day-close and file names drifted.
 * 2. Backend `created_at` / `updated_at` are SQLite `CURRENT_TIMESTAMP` values: **UTC without an offset**
 *    (`2026-11-20T09:15:00` or `2026-11-20 09:15:00`). `new Date(naive)` parses that as *local* time, so
 *    audit/log/notification times were shown 1–2 h off.
 * 3. LAN clients and replicas run on other machines whose OS clocks may drift from the host. Each window
 *    showed its own idea of "now". The host clock is the authority; clients apply a measured offset.
 *
 * Contract:
 * - Wall-clock values (`appointment.date` + `appointment.time`, work-plan days) are practice-local and
 *   are never converted. Use {@link localYmd} / {@link localHm} to produce them.
 * - Instants (`*_at`, `server_time`) go through {@link parseInstant}. Naive → UTC, offset/Z → as given,
 *   date-only → local midnight.
 * - "Now" is {@link clockNow}. Never call `new Date()` for business logic in views.
 */
import { useEffect, useState } from "react";

const NAIVE_DATETIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Max offset we trust from a single sample (protects against a broken host clock). */
const MAX_TRUSTED_OFFSET_MS = 12 * 60 * 60 * 1000;
/** Below this drift we do not correct (round-trip noise). */
const OFFSET_NOISE_MS = 1_500;

let offsetMs = 0;
let lastSampleAt = 0;
const listeners = new Set<() => void>();

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

/** Current instant corrected by the host clock offset (LAN client / replica). Desktop host: offset 0. */
export function clockNow(): Date {
    return new Date(Date.now() + offsetMs);
}

/** Epoch ms of {@link clockNow}. */
export function clockNowMs(): number {
    return Date.now() + offsetMs;
}

/** Measured offset host − local in ms (0 when not measured or within noise). */
export function clockOffsetMs(): number {
    return offsetMs;
}

/** When the offset was last measured (epoch ms, 0 = never). */
export function clockLastSampleAt(): number {
    return lastSampleAt;
}

/**
 * Feed one host-time sample (NTP-style midpoint). `sentAtMs`/`receivedAtMs` are local `Date.now()` values
 * around the request. Ignores implausible samples.
 */
export function recordHostClockSample(serverTimeIso: string, sentAtMs: number, receivedAtMs: number): void {
    const server = parseInstant(serverTimeIso);
    if (!server) return;
    const midpoint = sentAtMs + (receivedAtMs - sentAtMs) / 2;
    const next = server.getTime() - midpoint;
    if (!Number.isFinite(next) || Math.abs(next) > MAX_TRUSTED_OFFSET_MS) return;
    const applied = Math.abs(next) < OFFSET_NOISE_MS ? 0 : Math.round(next);
    lastSampleAt = receivedAtMs;
    if (applied === offsetMs) return;
    offsetMs = applied;
    listeners.forEach((fn) => fn());
}

/** Test / sign-out hook. */
export function resetPracticeClock(): void {
    offsetMs = 0;
    lastSampleAt = 0;
    listeners.forEach((fn) => fn());
}

export function subscribePracticeClock(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}

/**
 * Parse an instant from the backend. Returns `null` for empty / invalid input.
 * - `…Z` / `…+02:00` → exact instant
 * - naive `YYYY-MM-DD[T ]HH:MM[:SS]` → **UTC** (SQLite CURRENT_TIMESTAMP, chrono NaiveDateTime)
 * - `YYYY-MM-DD` → local midnight (calendar date, not an instant)
 */
export function parseInstant(raw: string | null | undefined): Date | null {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const dateOnly = DATE_ONLY.exec(s);
    if (dateOnly) {
        const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (HAS_ZONE.test(s)) {
        const d = new Date(s.replace(" ", "T"));
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const naive = NAIVE_DATETIME.exec(s);
    if (naive) {
        const d = new Date(`${naive[1]}T${naive[2]}Z`);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Practice-local calendar date `YYYY-MM-DD` (defaults to {@link clockNow}). */
export function localYmd(d: Date = clockNow()): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Practice-local wall time `HH:MM` (defaults to {@link clockNow}). */
export function localHm(d: Date = clockNow()): string {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Local calendar date of a backend instant (e.g. which day a payment's `created_at` belongs to). */
export function instantLocalYmd(raw: string | null | undefined): string {
    const d = parseInstant(raw);
    return d ? localYmd(d) : "";
}

/** File-name stamp `YYYY-MM-DD` in practice-local time. */
export function fileDateStamp(d: Date = clockNow()): string {
    return localYmd(d);
}

/** Combine practice-local wall-clock date + time into a Date (appointments, work plan). */
export function wallClockToDate(ymd: string, hm: string): Date | null {
    const m = DATE_ONLY.exec(ymd.trim());
    const t = /^(\d{1,2}):(\d{2})/.exec(hm.trim());
    if (!m || !t) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2]));
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * React hook: re-renders every `intervalMs` (aligned to the next minute by default) and when the clock
 * offset changes, so "now" markers, countdowns and relative times stay in sync across windows.
 */
export function useNow(intervalMs = 60_000): Date {
    const [now, setNow] = useState(() => clockNow());
    useEffect(() => {
        const tick = () => setNow(clockNow());
        const unsub = subscribePracticeClock(tick);
        const align = intervalMs >= 60_000 ? 60_000 - (clockNowMs() % 60_000) : intervalMs;
        let interval: ReturnType<typeof setInterval> | undefined;
        const first = setTimeout(() => {
            tick();
            interval = setInterval(tick, intervalMs);
        }, align);
        const onVisible = () => {
            if (document.visibilityState === "visible") tick();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            unsub();
            clearTimeout(first);
            if (interval) clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [intervalMs]);
    return now;
}
