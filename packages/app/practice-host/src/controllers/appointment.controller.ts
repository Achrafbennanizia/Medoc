import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { Appointment } from "@/models/types";
import {
    CreateAppointmentSchema,
    UpdateAppointmentSchema,
    parseOrThrow,
} from "@/lib/schemas";
import type { ListParams, ListResponse } from "@/lib/list-params";

import { defaultCreateAppointmentStatus, loadClientSettings } from "@/lib/client-settings";
export async function listAppointments(): Promise<Appointment[]> {
    return practiceSystem.invoke<Appointment[]>("list_appointments");
}

/** Paginated / date-filtered appointments for calendar and large lists. */
export async function listAppointmentsPaged(params?: ListParams): Promise<ListResponse<Appointment>> {
    return practiceSystem.invoke<ListResponse<Appointment>>("list_appointments_paged", { params });
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

/**
 * Create an appointment. Initial status policy lives here (not in pages):
 * explicit `status` wins, otherwise Settings → Workflows → "Automatically confirm new appointments".
 * The backend always inserts PLANNED; CONFIRMED is applied as an allowed transition (PLANNED → CONFIRMED).
 * If that second step fails the created row is returned unchanged (status PLANNED) so the caller can warn.
 */
export async function createAppointment(data: {
    date: string;
    time: string;
    kind: string;
    patient_id: string;
    physician_id: string;
    /** Free text / duration / internal notes (Rust `CreateAppointment.notes`). */
    notes?: string | null;
    chief_complaint?: string | null;
    status?: "PLANNED" | "CONFIRMED";
}): Promise<Appointment> {
    const { status, ...payload } = data;
    const safe = parseOrThrow(CreateAppointmentSchema, payload);
    let row = await practiceSystem.invoke<Appointment>("create_appointment", { data: safe });
    const target = status ?? defaultCreateAppointmentStatus(loadClientSettings());
    if (target === "CONFIRMED" && row.status !== "CONFIRMED") {
        try {
            row = await practiceSystem.invoke<Appointment>("update_appointment", {
                id: row.id,
                data: parseOrThrow(UpdateAppointmentSchema, { status: "CONFIRMED" }),
            });
        } catch {
            /* keep PLANNED row; caller decides how to inform the user */
        }
    }
    notifyAppointmentsChanged();
    return row;
}

export async function updateAppointment(id: string, data: Record<string, unknown>): Promise<Appointment> {
    const safe = parseOrThrow(UpdateAppointmentSchema, data);
    const row = await practiceSystem.invoke<Appointment>("update_appointment", { id, data: safe });
    notifyAppointmentsChanged();
    return row;
}

export async function deleteAppointment(id: string): Promise<void> {
    await practiceSystem.invoke("delete_appointment", { id });
    notifyAppointmentsChanged();
}
