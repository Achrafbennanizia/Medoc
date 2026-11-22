import {
    differenceInCalendarDays,
    differenceInCalendarWeeks,
    parseISO,
    startOfWeek,
} from "date-fns";

export type AppointmentsCalendarView = "day" | "week" | "month";

export type AppointmentsDeepLinkNav = {
    view: AppointmentsCalendarView;
    dayOffset: number;
    weekOffset: number;
    /** Caller supplies month offset from its own helper. */
    applyMonthOffset: boolean;
};

/**
 * Resolve `?view=` + `?date=` for the appointments page.
 * View is honored before date; week does not force day.
 */
export function resolveAppointmentsDeepLink(opts: {
    viewParam: string | null | undefined;
    dateParam: string | null | undefined;
    now?: Date;
}): AppointmentsDeepLinkNav | null {
    const viewRaw = (opts.viewParam ?? "").trim().toLowerCase();
    const requestedView: AppointmentsCalendarView | null =
        viewRaw === "week" || viewRaw === "day" || viewRaw === "month" ? viewRaw : null;
    const dateParam = opts.dateParam ?? "";
    const now = opts.now ?? new Date();

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const target = parseISO(dateParam);
        if (Number.isNaN(target.getTime())) return null;
        const view = requestedView ?? "day";
        if (view === "week") {
            const todayWeek = startOfWeek(now, { weekStartsOn: 1 });
            const targetWeek = startOfWeek(target, { weekStartsOn: 1 });
            return {
                view,
                weekOffset: differenceInCalendarWeeks(targetWeek, todayWeek, { weekStartsOn: 1 }),
                dayOffset: 0,
                applyMonthOffset: true,
            };
        }
        if (view === "month") {
            return { view, weekOffset: 0, dayOffset: 0, applyMonthOffset: true };
        }
        return {
            view: "day",
            dayOffset: differenceInCalendarDays(target, now),
            weekOffset: 0,
            applyMonthOffset: true,
        };
    }

    if (requestedView) {
        return {
            view: requestedView,
            dayOffset: 0,
            weekOffset: 0,
            applyMonthOffset: false,
        };
    }
    return null;
}
