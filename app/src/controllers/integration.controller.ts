import { tauriInvoke } from "@/services/tauri.service";

export interface UpcomingAppointment {
    termin_id: string;
    patient_id: string;
    patient_name: string;
    arzt_id: string;
    datum: string;
    uhrzeit: string;
    art: string;
    minutes_until: number;
}

export function listUpcomingAppointments(leadMinutes: number) {
    return tauriInvoke<UpcomingAppointment[]>("list_upcoming_appointments", { leadMinutes });
}
