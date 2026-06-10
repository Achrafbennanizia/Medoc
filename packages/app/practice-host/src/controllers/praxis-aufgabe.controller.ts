import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type PraxisAufgabeTyp =
    | "ABRECHNUNG"
    | "TERMIN"
    | "DRUCK"
    | "STAMMDATEN"
    | "SONSTIGES";

export type PraxisAufgabeStatus =
    | "OFFEN"
    | "IN_BEARBEITUNG"
    | "ERLEDIGT_REZEPTION"
    | "VALIDIERT"
    | "ZURUECK";

export type PraxisAufgabe = {
    id: string;
    patient_id: string | null;
    typ: PraxisAufgabeTyp;
    titel: string;
    body: string | null;
    assignee_role: string | null;
    assignee_user_id: string | null;
    created_by: string;
    behandlung_id: string | null;
    untersuchung_id: string | null;
    leistungsname: string | null;
    gesamtkosten: number | null;
    zahlung_id: string | null;
    erledigt_notiz: string | null;
    zurueck_begruendung: string | null;
    status: PraxisAufgabeStatus;
    legacy_ticket_id: string | null;
    created_at: string;
    updated_at: string;
};

export type PraxisAufgabeKommentar = {
    id: string;
    aufgabe_id: string;
    author_id: string;
    body: string;
    created_at: string;
};

export async function createPraxisAufgabe(data: {
    patientId: string;
    typ: PraxisAufgabeTyp;
    titel: string;
    body?: string | null;
    assigneeRole?: "REZEPTION" | null;
    assigneeUserId?: string | null;
    behandlungId?: string | null;
    untersuchungId?: string | null;
    leistungsname?: string | null;
    gesamtkosten?: number | null;
}): Promise<PraxisAufgabe> {
    return practiceSystem.invoke<PraxisAufgabe>("create_praxis_aufgabe", {
        data: {
            patientId: data.patientId,
            typ: data.typ,
            titel: data.titel,
            body: data.body ?? null,
            assigneeRole: data.assigneeRole ?? null,
            assigneeUserId: data.assigneeUserId ?? null,
            behandlungId: data.behandlungId ?? null,
            untersuchungId: data.untersuchungId ?? null,
            leistungsname: data.leistungsname ?? null,
            gesamtkosten: data.gesamtkosten ?? null,
        },
    });
}

export async function listPraxisAufgabenForMe(): Promise<PraxisAufgabe[]> {
    return practiceSystem.invoke<PraxisAufgabe[]>("list_praxis_aufgaben_for_me");
}

export async function transitionPraxisAufgabe(args: {
    id: string;
    status: PraxisAufgabeStatus;
    erledigtNotiz?: string | null;
    zahlungId?: string | null;
    zurueckBegruendung?: string | null;
}): Promise<PraxisAufgabe> {
    return practiceSystem.invoke<PraxisAufgabe>("transition_praxis_aufgabe", {
        args: {
            id: args.id,
            status: args.status,
            erledigtNotiz: args.erledigtNotiz ?? null,
            zahlungId: args.zahlungId ?? null,
            zurueckBegruendung: args.zurueckBegruendung ?? null,
        },
    });
}

export async function countOpenPraxisAufgabenForMe(): Promise<number> {
    return practiceSystem.invoke<number>("count_open_praxis_aufgaben_for_me");
}

export async function listPraxisAufgabenAdmin(): Promise<PraxisAufgabe[]> {
    return practiceSystem.invoke<PraxisAufgabe[]>("list_praxis_aufgaben_admin");
}

export async function createPraxisAufgabeAdmin(data: {
    patientId: string | null;
    typ: PraxisAufgabeTyp;
    titel: string;
    body?: string | null;
    assigneeRole?: "REZEPTION" | null;
    assigneeUserId?: string | null;
}): Promise<PraxisAufgabe> {
    return practiceSystem.invoke<PraxisAufgabe>("create_praxis_aufgabe_admin", {
        data: {
            patientId: data.patientId,
            typ: data.typ,
            titel: data.titel,
            body: data.body ?? null,
            assigneeRole: data.assigneeRole ?? null,
            assigneeUserId: data.assigneeUserId ?? null,
        },
    });
}

export async function updatePraxisAufgabeAdmin(patch: {
    id: string;
    titel?: string;
    body?: string | null;
    typ?: PraxisAufgabeTyp;
    assigneeRole?: "REZEPTION" | null;
    assigneeUserId?: string | null;
    status?: PraxisAufgabeStatus;
}): Promise<PraxisAufgabe> {
    return practiceSystem.invoke<PraxisAufgabe>("update_praxis_aufgabe_admin", {
        patch: {
            id: patch.id,
            titel: patch.titel,
            body: patch.body,
            typ: patch.typ,
            assigneeRole: patch.assigneeRole ?? null,
            assigneeUserId: patch.assigneeUserId ?? null,
            status: patch.status,
        },
    });
}

export async function listPraxisAufgabeKommentare(aufgabeId: string): Promise<PraxisAufgabeKommentar[]> {
    return practiceSystem.invoke<PraxisAufgabeKommentar[]>("list_praxis_aufgabe_kommentare", {
        aufgabeId,
    });
}

export async function addPraxisAufgabeKommentar(
    aufgabeId: string,
    body: string,
): Promise<PraxisAufgabeKommentar> {
    return practiceSystem.invoke<PraxisAufgabeKommentar>("add_praxis_aufgabe_kommentar", {
        args: { aufgabeId, body },
    });
}
