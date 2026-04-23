"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { terminSchema, type TerminFormData, type TerminFilter } from "@/lib/validators/termin";
import type { ActionResult } from "@/lib/utils";
import type { Termin, TerminStatus } from "@/types";

export async function createTermin(
    data: TerminFormData
): Promise<ActionResult<Termin>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "termine", "create");

    const parsed = terminSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    // Prüfe Konflikte
    const conflict = await db.termin.findFirst({
        where: {
            datum: parsed.data.datum,
            uhrzeit: parsed.data.uhrzeit,
            arztId: parsed.data.arztId,
            status: { notIn: ["STORNIERT"] },
        },
    });

    if (conflict) {
        return { success: false, error: "Dieser Zeitslot ist bereits belegt." };
    }

    const termin = await db.termin.create({ data: parsed.data });

    await logAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "Termin",
        entityId: termin.id,
    });

    return { success: true, data: termin };
}

export async function updateTermin(
    id: string,
    data: Partial<TerminFormData> & { status?: TerminStatus }
): Promise<ActionResult<Termin>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "termine", "update");

    const termin = await db.termin.update({
        where: { id },
        data,
    });

    await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Termin",
        entityId: id,
        details: data.status ? `Status → ${data.status}` : undefined,
    });

    return { success: true, data: termin };
}

export async function deleteTermin(
    id: string
): Promise<ActionResult<void>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "termine", "delete");

    await db.termin.delete({ where: { id } });

    await logAudit({
        userId: session.user.id,
        action: "DELETE",
        entity: "Termin",
        entityId: id,
    });

    return { success: true, data: undefined };
}

export async function getTermine(
    filter?: TerminFilter
): Promise<ActionResult<(Termin & { patient: { name: string }; arzt: { name: string } })[]>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "termine", "read");

    const where: Record<string, unknown> = {};
    if (filter?.datum) {
        const start = new Date(filter.datum);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filter.datum);
        end.setHours(23, 59, 59, 999);
        where.datum = { gte: start, lte: end };
    }
    if (filter?.arztId) where.arztId = filter.arztId;
    if (filter?.status) where.status = filter.status;

    const termine = await db.termin.findMany({
        where,
        include: {
            patient: { select: { name: true } },
            arzt: { select: { name: true } },
        },
        orderBy: [{ datum: "asc" }, { uhrzeit: "asc" }],
    });

    return { success: true, data: termine };
}

export async function getTermineForWeek(
    startDate: Date
): Promise<ActionResult<(Termin & { patient: { name: string }; arzt: { name: string } })[]>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "termine", "read");

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const termine = await db.termin.findMany({
        where: { datum: { gte: start, lt: end } },
        include: {
            patient: { select: { name: true } },
            arzt: { select: { name: true } },
        },
        orderBy: [{ datum: "asc" }, { uhrzeit: "asc" }],
    });

    return { success: true, data: termine };
}
