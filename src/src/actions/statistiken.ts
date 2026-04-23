"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAccess } from "@/lib/rbac";
import type { ActionResult } from "@/lib/utils";

export async function getPatientenStatistik(): Promise<
    ActionResult<{ monat: string; anzahl: number }[]>
> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "statistiken", "read");

    const patienten = await db.patient.findMany({
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
    });

    const monatlich = new Map<string, number>();
    for (const p of patienten) {
        const monat = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
        monatlich.set(monat, (monatlich.get(monat) || 0) + 1);
    }

    return {
        success: true,
        data: Array.from(monatlich.entries()).map(([monat, anzahl]) => ({
            monat,
            anzahl,
        })),
    };
}

export async function getTerminStatistik(): Promise<
    ActionResult<{ art: string; anzahl: number }[]>
> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "statistiken", "read");

    const termine = await db.termin.groupBy({
        by: ["art"],
        _count: { id: true },
    });

    return {
        success: true,
        data: termine.map((t) => ({ art: t.art, anzahl: t._count.id })),
    };
}

export async function getFinanzStatistik(
    jahr: number
): Promise<ActionResult<{ monat: string; einnahmen: number }[]>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "statistiken", "read");

    const zahlungen = await db.zahlung.findMany({
        where: {
            status: "BEZAHLT",
            createdAt: {
                gte: new Date(jahr, 0, 1),
                lt: new Date(jahr + 1, 0, 1),
            },
        },
    });

    const monatlich = new Map<string, number>();
    for (let m = 0; m < 12; m++) {
        const key = `${jahr}-${String(m + 1).padStart(2, "0")}`;
        monatlich.set(key, 0);
    }
    for (const z of zahlungen) {
        const key = `${z.createdAt.getFullYear()}-${String(z.createdAt.getMonth() + 1).padStart(2, "0")}`;
        monatlich.set(key, (monatlich.get(key) || 0) + z.betrag);
    }

    return {
        success: true,
        data: Array.from(monatlich.entries()).map(([monat, einnahmen]) => ({
            monat,
            einnahmen,
        })),
    };
}

export async function getAuditLogs(params?: {
    entity?: string;
    take?: number;
}): Promise<ActionResult<unknown[]>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "audit", "read");

    const logs = await db.auditLog.findMany({
        where: params?.entity ? { entity: params.entity } : undefined,
        include: { user: { select: { name: true, rolle: true } } },
        orderBy: { timestamp: "desc" },
        take: params?.take || 100,
    });

    return { success: true, data: logs };
}
