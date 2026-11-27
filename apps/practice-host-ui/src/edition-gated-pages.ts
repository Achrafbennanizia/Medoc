/**
 * Pages of capability-gated feature modules (packages/shared/src/lib/feature-modules.ts).
 * Each `__CAP_*__` literal lets Rollup drop the page chunk from editions without the module.
 */
import { lazy } from "react";

/** Stand-in for a page this edition does not have. Never rendered: the route guard refuses the route first. */
function NotInEdition(): null {
    return null;
}

export const ChartsToValidatePage = __CAP_VALIDATION__
    ? lazy(async () => ({
        default: (await import("@/systems/practice-host/pages/charts-to-validate")).ChartsToValidatePage,
      }))
    : NotInEdition;

export const PracticeTicketsPage = __CAP_TASKS__
    ? lazy(async () => ({
        default: (await import("./views/pages/practice-tickets")).PracticeTicketsPage,
      }))
    : NotInEdition;

export const PracticeTaskCreatePage = __CAP_TASKS__
    ? lazy(async () => ({
        default: (await import("./views/pages/practice-task-create")).PracticeTaskCreatePage,
      }))
    : NotInEdition;

export const PracticeTaskEditPage = __CAP_TASKS__
    ? lazy(async () => ({
        default: (await import("./views/pages/practice-task-edit")).PracticeTaskEditPage,
      }))
    : NotInEdition;

export const StaffPage = __CAP_MULTI_STAFF__
    ? lazy(async () => ({ default: (await import("./views/pages/staff")).StaffPage }))
    : NotInEdition;

export const StaffWorkPlanPage = __CAP_WORK_TIME__
    ? lazy(async () => ({
        default: (await import("./views/pages/staff-work-plan")).StaffWorkPlanPage,
      }))
    : NotInEdition;

export const WorkTimeTrackingPage = __CAP_WORK_TIME__
    ? lazy(async () => ({
        default: (await import("./views/pages/work-time-tracking")).WorkTimeTrackingPage,
      }))
    : NotInEdition;

export const WorkTimeTeamPage = __CAP_WORK_TIME__
    ? lazy(async () => ({
        default: (await import("./views/pages/work-time-team")).WorkTimeTeamPage,
      }))
    : NotInEdition;

export const AdministrationTeamPage = __CAP_MULTI_STAFF__
    ? lazy(async () => ({
        default: (await import("./views/pages/administration-team")).AdministrationTeamPage,
      }))
    : NotInEdition;

export const SickLeaveCertificateFormPage = __CAP_WORK_TIME__
    ? lazy(async () => ({
        default: (await import("./views/pages/sick-leave-certificate-administration")).SickLeaveCertificateFormPage,
      }))
    : NotInEdition;

export const GuestInboxPage = __CAP_GUEST_INBOX__
    ? lazy(async () => ({ default: (await import("./views/pages/guest-inbox")).GuestInboxPage }))
    : NotInEdition;

export const DayClosePage = __CAP_DAY_CLOSE__
    ? lazy(async () => ({ default: (await import("./views/pages/day-close")).DayClosePage }))
    : NotInEdition;
