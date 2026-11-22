/** `YYYY-MM-DD` (or a longer ISO string) → local Date at midnight. */
import { parseISO } from "date-fns";

export function parseYmd(s: string): Date {
    return parseISO(s.length >= 10 ? s.slice(0, 10) : s);
}
