import type { z } from "zod";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { Appointment } from "@/models/types";
import {
    CreateAppointmentSchema,
    UpdateAppointmentSchema,
    parseOrThrow,
} from "@/lib/schemas";
import type { ListParams, ListResponse } from "@/lib/list-params";

export async function listAppointments(): Promise<Appointment[]> {
    return practiceSystem.invoke<Appointment[]>("list_appointments");
}

/** Paginated / date-filtered appointments for calendar and large lists. */
export async function listAppointmentsPaged(params?: ListParams): Promise<ListResponse<Appointment>> {
    return practiceSystem.invoke<ListResponse<Appointment>>("list_appointments_paged", { params });
}

/** F63: every appointment with `fromDate <= date <= toDate` (yyyy-MM-dd), no paging. */
export async function listAppointmentsInRange(fromDate: string, toDate: string): Promise<Appointment[]> {
    return practiceSystem.invoke<Appointment[]>("list_appointments_in_range", { fromDate, toDate });
}

/** F70: move several appointments in one transaction (all or nothing). */
export async function moveAppointments(
    changes: { id: string; date: string; time: string }[],
): Promise<Appointment[]> {
    const rows = await practiceSystem.invoke<Appointment[]>("move_appointments", { changes });
    notifyAppointmentsChanged();
    return rows;
}

export async function listAppointmentsByDate(date: string): Promise<Appointment[]> {
    return practiceSystem.invoke<Appointment[]>("list_appointments_by_date", { date });
}

export async function getAppointment(id: string): Promise<Appointment> {
    return practiceSystem.invoke<Appointment>("get_appointment", { id });
}

export const APPOINTMENTS_CHANGED_EVENT = "medoc-appointments-changed";

export function notifyAppointmentsChanged(): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(APPOINTMENTS_CHANGED_EVENT));
}

export async function createAppointment(
    data: z.input<typeof CreateAppointmentSchema>,
): Promise<Appointment> {
    const safe = parseOrThrow(CreateAppointmentSchema, data);
    const row = await practiceSystem.invoke<Appointment>("create_appointment", { data: safe });
    notifyAppointmentsChanged();
    return row;
}

export async function updateAppointment(
    id: string,
    data: z.input<typeof UpdateAppointmentSchema>,
): Promise<Appointment> {
    const safe = parseOrThrow(UpdateAppointmentSchema, data);
    const row = await practiceSystem.invoke<Appointment>("update_appointment", { id, data: safe });
    notifyAppointmentsChanged();
    return row;
}

export async function deleteAppointment(id: string): Promise<void> {
    await practiceSystem.invoke("delete_appointment", { id });
    notifyAppointmentsChanged();
}
