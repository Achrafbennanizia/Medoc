import {
    listTaskTeamDirectory,
    listStaff,
} from "@/systems/practice-host/controllers/staff.controller";
import { allowed, type Role } from "@/lib/rbac";
import type { PermissionOverride, Staff } from "@/models/types";

function teamMemberToStaff(member: { id: string; name: string; role: string }): Staff {
    return {
        id: member.id,
        name: member.name,
        email: "",
        role: member.role as Staff["role"],
        activity_area: null,
        specialty: null,
        phone: null,
        available: true,
        created_at: "",
        updated_at: "",
    };
}

/** HR list when allowed; otherwise minimal Physician/Reception directory for Aufgaben UI. */
export async function loadTaskTeamDirectory(
    role: Role | null,
    overrides?: readonly PermissionOverride[] | null,
): Promise<Staff[]> {
    if (role != null && allowed("staff.read", role, overrides)) {
        return listStaff();
    }
    const team = await listTaskTeamDirectory();
    return team.map(teamMemberToStaff);
}
