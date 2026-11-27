/**
 * Doctor dimension of the UI, chosen by edition (docs/architecture/editions-plan.md §3.4).
 *
 * Solo and Duo are single-doctor: the doctor is implicit, so no picker, filter, legend or
 * "default doctor" setting appears and forms fill in the practice's physician themselves.
 * Group (`multiDoctor`) shows them. Components ask this context, never the edition.
 */

type HasId = { id: string };

export type DoctorContext = {
    /** Show doctor pickers, filters, legends and per-doctor settings. */
    showDoctorUi: boolean;
    /**
     * Doctor a form uses when it does not ask: `preferred` if it is a known physician; otherwise,
     * single-doctor, the practice's physician; multi-doctor, none (the user picks).
     */
    defaultDoctorId(physicians: readonly HasId[], preferred?: string | null): string;
};

const known = (physicians: readonly HasId[], id?: string | null): id is string =>
    Boolean(id) && physicians.some((p) => p.id === id);

export const SINGLE_DOCTOR: DoctorContext = {
    showDoctorUi: false,
    defaultDoctorId: (physicians, preferred) => (known(physicians, preferred) ? preferred : physicians[0]?.id ?? ""),
};

export const MULTI_DOCTOR: DoctorContext = {
    showDoctorUi: true,
    defaultDoctorId: (physicians, preferred) => (known(physicians, preferred) ? preferred : ""),
};

export const DOCTOR_CONTEXT: DoctorContext = __CAP_MULTI_DOCTOR__ ? MULTI_DOCTOR : SINGLE_DOCTOR;
