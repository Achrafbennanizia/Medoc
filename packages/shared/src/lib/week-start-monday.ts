/** Monday of the week containing `d` (ISO weeks start on Monday). */
import { startOfWeek } from "date-fns";

export function weekStartMonday(d: Date): Date {
    return startOfWeek(d, { weekStartsOn: 1 });
}
