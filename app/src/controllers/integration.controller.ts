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
    return tauriInvoke<UpcomingAppointment[]>("list_upcoming_appointments", {
        lead_minutes: leadMinutes,
    });
}

/* ──────────────── E-Rezept (FA-INT, FA-REZ) ─────────────────────────────── */

/** Matches Rust `infrastructure::telematik::EPrescription`. */
export interface EPrescription {
    patient_id: string;
    /** 10-char Krankenversichertennummer. */
    kvnr: string;
    /** 8-digit Pharmazentralnummer with check digit. */
    pzn: string;
    medication_name: string;
    dosage: string;
    quantity: number;
    /** 9-digit Lebenslange Arztnummer. */
    doctor_lanr: string;
    /** ISO date the prescription was issued. */
    issued_at: string;
}

export interface EPrescriptionToken {
    task_id: string;
    access_code: string;
    redeem_url: string;
}

/**
 * Validate an E-Rezept locally (PZN, KVNR, LANR, quantity).
 * Resolves on success; rejects with `AppError::Validation` text on failure.
 */
export function validateEprescription(rx: EPrescription): Promise<void> {
    return tauriInvoke<void>("validate_eprescription", { rx });
}

/**
 * Submit via TI. Currently always rejects with a typed "not implemented"
 * error until the gematik connector + HBA flow is wired.
 */
export function submitEprescription(rx: EPrescription): Promise<EPrescriptionToken> {
    return tauriInvoke<EPrescriptionToken>("submit_eprescription", { rx });
}

/* ──────────────── KIM secure messaging ──────────────────────────────────── */

export interface KimMessage {
    from: string;
    to: string;
    subject: string;
    body: string;
}

export function sendKimMessage(msg: KimMessage): Promise<void> {
    return tauriInvoke<void>("send_kim_message", { msg });
}
