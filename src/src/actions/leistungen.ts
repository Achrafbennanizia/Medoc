"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { leistungSchema, type LeistungFormData } from "@/lib/validators/personal";
import type { ActionResult } from "@/lib/utils";
import type { Leistung } from "@/types";

export async function createLeistung(
    data: LeistungFormData
): Promise<ActionResult<Leistung>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "leistungen", "create");

    const parsed = leistungSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const leistung = await db.leistung.create({ data: parsed.data });

    await logAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "Leistung",
        entityId: leistung.id,
    });

    return { success: true, data: leistung };
}

export async function updateLeistung(
    id: string,
    data: Partial<LeistungFormData>
): Promise<ActionResult<Leistung>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "leistungen", "update");

    const leistung = await db.leistung.update({ where: { id }, data });

    await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Leistung",
        entityId: id,
    });

    return { success: true, data: leistung };
}

export async function getLeistungen(): Promise<ActionResult<Leistung[]>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "leistungen", "read");

    const leistungen = await db.leistung.findMany({
        orderBy: { kategorie: "asc" },
    });

    return { success: true, data: leistungen };
}

export async function deleteLeistung(
    id: string
): Promise<ActionResult<void>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "leistungen", "delete");

    await db.leistung.update({ where: { id }, data: { aktiv: false } });

    await logAudit({
        userId: session.user.id,
        action: "DELETE",
        entity: "Leistung",
        entityId: id,
    });

    return { success: true, data: undefined };
}
