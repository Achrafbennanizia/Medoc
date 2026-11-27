import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";

export type ChartToValidateRow = {
    patient_id: string;
    patient_name: string;
    chart_id: string;
    chart_status: string;
    updated_at: string;
    /** Group: the doctor the chart belongs to (T5.5). */
    owner_staff_id?: string | null;
    /** Group: false when the owner's sharing rules do not let this person validate it. */
    can_validate?: boolean;
};

export type PracticeTicket = {
    id: string;
    patient_id: string;
    from_user_id: string;
    to_physician_id: string;
    body: string;
    status: string;
    created_at: string;
    updated_at: string;
};

export async function listChartsToValidate(): Promise<ChartToValidateRow[]> {
    const rows = await practiceSystem.invoke<ChartToValidateRow[]>("list_charts_to_validate");
    return [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function countChartsToValidate(): Promise<number> {
    return practiceSystem.invoke<number>("count_charts_to_validate");
}

export async function validatePatientChart(patientId: string): Promise<void> {
    await practiceSystem.invoke("validate_patient_chart", { id: patientId });
}

export async function declinePatientChart(patientId: string): Promise<void> {
    await practiceSystem.invoke("decline_patient_chart", { id: patientId });
}

export async function forwardChartToPhysicians(args: {
    patientId: string;
    physicianIds: string[];
    message?: string | null;
}): Promise<void> {
    await practiceSystem.invoke("forward_chart_to_physicians", {
        args: {
            patientId: args.patientId,
            physicianIds: args.physicianIds,
            message: args.message ?? undefined,
        },
    });
}

export async function createPracticeTicket(args: {
    patientId: string;
    toPhysicianId: string;
    body: string;
}): Promise<PracticeTicket> {
    return practiceSystem.invoke<PracticeTicket>("create_practice_ticket", {
        args: { patientId: args.patientId, toPhysicianId: args.toPhysicianId, body: args.body },
    });
}

export async function listPracticeTicketsForMe(): Promise<PracticeTicket[]> {
    return practiceSystem.invoke<PracticeTicket[]>("list_practice_tickets_for_me");
}

export async function updatePracticeTicketStatus(id: string, status: "IN_PROGRESS" | "DONE"): Promise<PracticeTicket> {
    return practiceSystem.invoke<PracticeTicket>("update_practice_ticket_status", {
        args: { id, status },
    });
}

export async function countOpenPracticeTicketsForMe(): Promise<number> {
    return practiceSystem.invoke<number>("count_open_practice_tickets_for_me");
}
