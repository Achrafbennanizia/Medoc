/** Two-digit, zero-padded number (`7` → `"07"`) for dates and times. */
export function pad2(n: number): string {
    return String(n).padStart(2, "0");
}
