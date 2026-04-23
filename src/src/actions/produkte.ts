"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { produktSchema, type ProduktFormData } from "@/lib/validators/personal";
import type { ActionResult } from "@/lib/utils";
import type { Produkt } from "@/types";

export async function createProdukt(
    data: ProduktFormData
): Promise<ActionResult<Produkt>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "produkte", "create");

    const parsed = produktSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const produkt = await db.produkt.create({ data: parsed.data });

    await logAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "Produkt",
        entityId: produkt.id,
    });

    return { success: true, data: produkt };
}

export async function updateProdukt(
    id: string,
    data: Partial<ProduktFormData>
): Promise<ActionResult<Produkt>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "produkte", "update");

    const produkt = await db.produkt.update({ where: { id }, data });

    await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Produkt",
        entityId: id,
    });

    return { success: true, data: produkt };
}

export async function getProdukte(): Promise<ActionResult<Produkt[]>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "produkte", "read");

    const produkte = await db.produkt.findMany({
        orderBy: { name: "asc" },
    });

    return { success: true, data: produkte };
}

export async function deleteProdukt(
    id: string
): Promise<ActionResult<void>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "produkte", "delete");

    await db.produkt.delete({ where: { id } });

    await logAudit({
        userId: session.user.id,
        action: "DELETE",
        entity: "Produkt",
        entityId: id,
    });

    return { success: true, data: undefined };
}
