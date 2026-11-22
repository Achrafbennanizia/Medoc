/** ISO weekday of a `YYYY-MM-DD` date: 1 = Monday … 7 = Sunday. */
import { getISODay } from "date-fns";
import { parseYmd } from "./parse-ymd";

export function isoWeekdayFromYmd(dateStr: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
    return getISODay(parseYmd(dateStr)) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
