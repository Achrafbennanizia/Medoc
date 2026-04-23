"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { personalSchema, type PersonalFormData } from "@/lib/validators/personal";
import bcrypt from "bcryptjs";
import type { ActionResult } from "@/lib/utils";
import type { Personal } from "@/types";

export async function createPersonal(
    data: PersonalFormData
): Promise<ActionResult<Omit<Personal, "passwort">>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "personal", "create");

    const parsed = personalSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const existing = await db.personal.findUnique({
        where: { email: parsed.data.email },
    });
    if (existing) {
        return { success: false, error: "E-Mail bereits vergeben" };
    }

    const { passwort: plainPasswort, ...personalData } = parsed.data;
    const hashedPasswort = await bcrypt.hash(plainPasswort, 12);
    const personal = await db.personal.create({
        data: { ...personalData, passwort: hashedPasswort },
        select: {
            id: true,
            name: true,
            email: true,
            rolle: true,
            taetigkeitsbereich: true,
            fachrichtung: true,
            telefon: true,
            verfuegbar: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    await logAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "Personal",
        entityId: personal.id,
    });

    return { success: true, data: personal as Omit<Personal, "passwort"> };
}

export async function getPersonal(): Promise<
    ActionResult<Omit<Personal, "passwort">[]>
> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "personal", "read");

    const personal = await db.personal.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            rolle: true,
            taetigkeitsbereich: true,
            fachrichtung: true,
            telefon: true,
            verfuegbar: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { name: "asc" },
    });

    return { success: true, data: personal as Omit<Personal, "passwort">[] };
}

export async function updatePersonal(
    id: string,
    data: Partial<Omit<PersonalFormData, "passwort">>
): Promise<ActionResult<Omit<Personal, "passwort">>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "personal", "update");

    const personal = await db.personal.update({
        where: { id },
        data,
        select: {
            id: true,
            name: true,
            email: true,
            rolle: true,
            taetigkeitsbereich: true,
            fachrichtung: true,
            telefon: true,
            verfuegbar: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Personal",
        entityId: id,
    });

    return { success: true, data: personal as Omit<Personal, "passwort"> };
}

export async function deletePersonal(
    id: string
): Promise<ActionResult<void>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "personal", "delete");

    if (id === session.user.id) {
        return { success: false, error: "Sie können sich nicht selbst löschen." };
    }

    await db.personal.delete({ where: { id } });

    await logAudit({
        userId: session.user.id,
        action: "DELETE",
        entity: "Personal",
        entityId: id,
    });

    return { success: true, data: undefined };
}

export async function getAerzte(): Promise<
    ActionResult<{ id: string; name: string }[]>
> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    const aerzte = await db.personal.findMany({
        where: { rolle: "ARZT", verfuegbar: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });

    return { success: true, data: aerzte };
}
