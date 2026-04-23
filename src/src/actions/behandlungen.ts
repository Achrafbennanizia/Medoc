"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
    behandlungSchema,
    untersuchungSchema,
    type BehandlungFormData,
    type UntersuchungFormData,
} from "@/lib/validators/behandlung";
import type { ActionResult } from "@/lib/utils";
import type { Behandlung, Untersuchung } from "@/types";

export async function createUntersuchung(
    data: UntersuchungFormData
): Promise<ActionResult<Untersuchung>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "behandlung", "create");

    const parsed = untersuchungSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const untersuchung = await db.untersuchung.create({ data: parsed.data });

    await logAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "Untersuchung",
        entityId: untersuchung.id,
    });

    return { success: true, data: untersuchung };
}

export async function createBehandlung(
    data: BehandlungFormData
): Promise<ActionResult<Behandlung>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "behandlung", "create");

    const parsed = behandlungSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const behandlung = await db.behandlung.create({ data: parsed.data });

    await logAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "Behandlung",
        entityId: behandlung.id,
    });

    return { success: true, data: behandlung };
}

export async function updateBehandlung(
    id: string,
    data: Partial<BehandlungFormData>
): Promise<ActionResult<Behandlung>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "behandlung", "update");

    const behandlung = await db.behandlung.update({
        where: { id },
        data,
    });

    await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Behandlung",
        entityId: id,
    });

    return { success: true, data: behandlung };
}

export async function updateZahnbefund(params: {
    akteId: string;
    zahnNummer: number;
    befund: string;
    diagnose?: string;
    behandlung?: string;
    notizen?: string;
}): Promise<ActionResult<void>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "zahnschema", "update");

    await db.zahnbefund.upsert({
        where: {
            akteId_zahnNummer: {
                akteId: params.akteId,
                zahnNummer: params.zahnNummer,
            },
        },
        create: params,
        update: {
            befund: params.befund,
            diagnose: params.diagnose,
            behandlung: params.behandlung,
            notizen: params.notizen,
        },
    });

    await logAudit({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Zahnbefund",
        details: `Zahn ${params.zahnNummer}`,
    });

    return { success: true, data: undefined };
}

export async function saveAnamnesebogen(params: {
    patientId: string;
    antworten: Record<string, string>;
    unterschrieben: boolean;
}): Promise<ActionResult<void>> {
    const session = await auth();
    if (!session) return { success: false, error: "Nicht angemeldet" };

    requireAccess(session.user.rolle, "anamnesebogen", "create");

    await db.anamnesebogen.upsert({
        where: { patientId: params.patientId },
        create: params,
        update: {
            antworten: params.antworten,
            unterschrieben: params.unterschrieben,
        },
    });

    await logAudit({
        userId: session.user.id,
        action: "UPSERT",
        entity: "Anamnesebogen",
        details: `Patient ${params.patientId}`,
    });

    return { success: true, data: undefined };
}
