"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { zahlungSchema, type ZahlungFormData } from "@/lib/validators/zahlung";
import type { ActionResult } from "@/lib/utils";
import type { Zahlung, ZahlungStatus } from "@/types";

export async function createZahlung(
    data: ZahlungFormData
): Promise<ActionResult<Zahlung>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "zahlungen", "create");

    const parsed = zahlungSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const zahlung = await db.zahlung.create({ data: parsed.data });

    await logAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "Zahlung",
        entityId: zahlung.id,
    });

    return { success: true, data: zahlung };
}

export async function updateZahlungStatus(
    id: string,
    status: ZahlungStatus
): Promise<ActionResult<Zahlung>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "zahlungen", "update");

    const zahlung = await db.zahlung.update({
        where: { id },
        data: { status },
    });

    await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Zahlung",
        entityId: id,
        details: `Status → ${status}`,
    });

    return { success: true, data: zahlung };
}

export async function getZahlungen(): Promise<
    ActionResult<(Zahlung & { patient: { name: string }; leistung: { name: string } | null })[]>
> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "zahlungen", "read");

    const zahlungen = await db.zahlung.findMany({
        include: {
            patient: { select: { name: true } },
            leistung: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return { success: true, data: zahlungen };
}

export async function getBilanz(
    zeitraum: { von: Date; bis: Date }
): Promise<ActionResult<{ einnahmen: number; ausgaben: number; saldo: number }>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "finanzen", "read");

    const zahlungen = await db.zahlung.findMany({
        where: {
            status: "BEZAHLT",
            createdAt: { gte: zeitraum.von, lte: zeitraum.bis },
        },
    });

    const einnahmen = zahlungen.reduce((sum, z) => sum + z.betrag, 0);

    const ausgaben = await db.finanzdokument.aggregate({
        where: {
            typ: "Ausgabe",
            zeitraum: { gte: zeitraum.von, lte: zeitraum.bis },
        },
        _sum: { betrag: true },
    });

    const ausgabenSum = ausgaben._sum.betrag || 0;

    return {
        success: true,
        data: {
            einnahmen,
            ausgaben: ausgabenSum,
            saldo: einnahmen - ausgabenSum,
        },
    };
}
