import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type AkteZuValidierenRow = {
    patient_id: string;
    patient_name: string;
    akte_id: string;
    akte_status: string;
    updated_at: string;
};

export type PraxisTicket = {
    id: string;
    patient_id: string;
    from_user_id: string;
    to_arzt_id: string;
    body: string;
    status: string;
    created_at: string;
    updated_at: string;
};

export async function listAktenZuValidieren(): Promise<AkteZuValidierenRow[]> {
    return practiceSystem.invoke<AkteZuValidierenRow[]>("list_akten_zu_validieren");
}

export async function countAktenZuValidieren(): Promise<number> {
    return practiceSystem.invoke<number>("count_akten_zu_validieren");
}

export async function validatePatientenakte(patientId: string): Promise<void> {
    await practiceSystem.invoke("validate_patientenakte", { id: patientId });
}

export async function forwardAkteToPhysicians(args: {
    patientId: string;
    arztIds: string[];
    message?: string | null;
}): Promise<void> {
    await practiceSystem.invoke("forward_akte_to_physicians", {
        args: {
            patientId: args.patientId,
            arztIds: args.arztIds,
            message: args.message ?? undefined,
        },
    });
}

export async function createPraxisTicket(args: {
    patientId: string;
    toArztId: string;
    body: string;
}): Promise<PraxisTicket> {
    return practiceSystem.invoke<PraxisTicket>("create_praxis_ticket", {
        args: { patientId: args.patientId, toArztId: args.toArztId, body: args.body },
    });
}

export async function listPraxisTicketsForMe(): Promise<PraxisTicket[]> {
    return practiceSystem.invoke<PraxisTicket[]>("list_praxis_tickets_for_me");
}

export async function updatePraxisTicketStatus(id: string, status: "IN_BEARBEITUNG" | "ERLEDIGT"): Promise<PraxisTicket> {
    return practiceSystem.invoke<PraxisTicket>("update_praxis_ticket_status", {
        args: { id, status },
    });
}

export async function countOpenPraxisTicketsForMe(): Promise<number> {
    return practiceSystem.invoke<number>("count_open_praxis_tickets_for_me");
}
