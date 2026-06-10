import {
    listAufgabeTeamDirectory,
    listPersonal,
} from "@/systems/practice-host/controllers/personal.controller";
import { allowed, type Role } from "@/lib/rbac";
import type { PermissionOverride, Personal } from "@/models/types";

function teamMemberToPersonal(member: { id: string; name: string; rolle: string }): Personal {
    return {
        id: member.id,
        name: member.name,
        email: "",
        rolle: member.rolle as Personal["rolle"],
        taetigkeitsbereich: null,
        fachrichtung: null,
        telefon: null,
        verfuegbar: true,
        created_at: "",
        updated_at: "",
    };
}

/** HR list when allowed; otherwise minimal Arzt/Rezeption directory for Aufgaben UI. */
export async function loadAufgabeTeamDirectory(
    role: Role | null,
    overrides?: readonly PermissionOverride[] | null,
): Promise<Personal[]> {
    if (role != null && allowed("personal.read", role, overrides)) {
        return listPersonal();
    }
    const team = await listAufgabeTeamDirectory();
    return team.map(teamMemberToPersonal);
}
