"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { patientSchema, type PatientFormData } from "@/lib/validators/patient";
import type { ActionResult } from "@/lib/utils";
import type { Patient, Patientenakte } from "@/types";

export async function createPatient(
    data: PatientFormData
): Promise<ActionResult<Patient>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "patienten", "create");

    const parsed = patientSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const patient = await db.patient.create({
        data: {
            ...parsed.data,
            akte: { create: {} },
        },
    });

    await logAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "Patient",
        entityId: patient.id,
        details: `Patient ${patient.name} angelegt`,
    });

    return { success: true, data: patient };
}

export async function updatePatient(
    id: string,
    data: Partial<PatientFormData>
): Promise<ActionResult<Patient>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "patienten", "update");

    const patient = await db.patient.update({
        where: { id },
        data,
    });

    await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Patient",
        entityId: id,
    });

    return { success: true, data: patient };
}

export async function deletePatient(
    id: string
): Promise<ActionResult<void>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "patienten", "delete");

    await db.patient.delete({ where: { id } });

    await logAudit({
        userId: session.user.id,
        action: "DELETE",
        entity: "Patient",
        entityId: id,
    });

    return { success: true, data: undefined };
}

export async function searchPatienten(
    query: string
): Promise<ActionResult<Patient[]>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "patienten", "read");

    const patienten = await db.patient.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: "insensitive" } },
                { versicherungsnummer: { contains: query, mode: "insensitive" } },
            ],
        },
        orderBy: { name: "asc" },
        take: 50,
    });

    return { success: true, data: patienten };
}

export async function getPatienten(): Promise<ActionResult<Patient[]>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "patienten", "read");

    const patienten = await db.patient.findMany({
        orderBy: { name: "asc" },
    });

    return { success: true, data: patienten };
}

export async function getPatientMitAkte(
    id: string
): Promise<
    ActionResult<
        Patient & {
            akte: (Patientenakte & {
                untersuchungen: unknown[];
                behandlungen: unknown[];
                zahnbefunde: unknown[];
                dokumente: unknown[];
            }) | null;
            termine: unknown[];
            zahlungen: unknown[];
            anamnesebogen: unknown | null;
        }
    >
> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "patienten", "read");

    const patient = await db.patient.findUnique({
        where: { id },
        include: {
            akte: {
                include: {
                    untersuchungen: { orderBy: { createdAt: "desc" } },
                    behandlungen: { orderBy: { createdAt: "desc" }, include: { leistung: true } },
                    zahnbefunde: true,
                    dokumente: { orderBy: { createdAt: "desc" } },
                },
            },
            termine: { orderBy: { datum: "desc" }, take: 10, include: { arzt: true } },
            zahlungen: { orderBy: { createdAt: "desc" } },
            anamnesebogen: true,
        },
    });

    if (!patient) return { success: false, error: "Patient nicht gefunden" };

    return { success: true, data: patient as never };
}
