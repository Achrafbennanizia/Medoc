/**
 * Keeps practice hours (Sprechzeiten) in sync across devices via SQLite `app_kv`.
 * Admin changes on any workstation propagate to all logged-in clients.
 * Also runs the appointment↔hours compliance scan at least once per local day.
 */

import { useEffect } from "react";
import { useAuthStore } from "../../models/store/auth-store";
import {
    bindPracticeWorkHoursStoreEvents,
    usePracticeWorkHoursStore,
} from "@/models/store/practice-work-hours-store";
import { mergeCalendarWorkflowsFromKv } from "@/lib/practice-calendar-workflows-sync";
import { formatPracticeOpeningHours, type PracticeDayKey } from "@/lib/practice-planning";
import { patchInvoicePracticeOpeningHours } from "@/lib/invoice-service-item";
import { translateLocale, useLocale, useT, useTParams } from "@/lib/i18n";
import {
    notifyAppointmentsOutsideWorkHours,
    runDailyAppointmentHoursComplianceIfDue,
} from "@/lib/appointment-hours-compliance-notify";
import { PRACTICE_WORK_HOURS_CHANGED_EVENT } from "@/lib/appointment-calendar-layout";

const REFRESH_INTERVAL_MS = 500;
/** How often we re-check whether today's precaution compliance scan is still due. */
const COMPLIANCE_POLL_MS = 15 * 60 * 1000;

export function PracticeWorkHoursBackground() {
    const sessionChecked = useAuthStore((s) => s.sessionChecked);
    const session = useAuthStore((s) => s.session);
    const workHours = usePracticeWorkHoursStore((s) => s.config);
    const locale = useLocale((s) => s.locale);
    const t = useT();
    const tp = useTParams();

    useEffect(() => {
        if (!sessionChecked) return undefined;
        const unbind = bindPracticeWorkHoursStoreEvents();
        return unbind;
    }, [sessionChecked]);

    useEffect(() => {
        if (!sessionChecked || !session) return undefined;
        let cancelled = false;

        const refresh = () => {
            if (cancelled) return;
            void usePracticeWorkHoursStore.getState().refresh();
            void mergeCalendarWorkflowsFromKv();
        };

        refresh();
        const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
        const onVis = () => {
            if (document.visibilityState === "visible") refresh();
        };
        const onOnline = () => refresh();
        document.addEventListener("visibilitychange", onVis);
        window.addEventListener("online", onOnline);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVis);
            window.removeEventListener("online", onOnline);
        };
    }, [sessionChecked, session]);

    useEffect(() => {
        if (!sessionChecked || !session) return undefined;
        const summary = formatPracticeOpeningHours(workHours, (key: PracticeDayKey) =>
            translateLocale(locale, `page.workTime.day_short.${key}`),
        );
        if (!summary) return undefined;
        let cancelled = false;
        void patchInvoicePracticeOpeningHours(summary).catch(() => {
            if (cancelled) return;
        });
        return () => {
            cancelled = true;
        };
    }, [locale, session, sessionChecked, workHours]);

    useEffect(() => {
        if (!sessionChecked || !session) return undefined;
        let cancelled = false;

        const run = () => {
            if (cancelled) return;
            void runDailyAppointmentHoursComplianceIfDue({
                practiceCfg: usePracticeWorkHoursStore.getState().config,
                t,
                tp,
            }).catch(() => undefined);
        };

        run();
        const timer = window.setInterval(run, COMPLIANCE_POLL_MS);
        const onVis = () => {
            if (document.visibilityState === "visible") run();
        };
        const onHoursChanged = () => {
            if (cancelled) return;
            // Schedule edits must re-scan even if today's precaution pass already ran.
            void notifyAppointmentsOutsideWorkHours({
                practiceCfg: usePracticeWorkHoursStore.getState().config,
                t,
                tp,
            }).catch(() => undefined);
        };
        document.addEventListener("visibilitychange", onVis);
        window.addEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onHoursChanged);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVis);
            window.removeEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onHoursChanged);
        };
    }, [sessionChecked, session, t, tp]);

    return null;
}
