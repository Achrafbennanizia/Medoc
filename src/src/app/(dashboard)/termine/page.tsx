import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TermineClient } from "./termine-client";

export default async function TerminePage() {
    const session = await auth();
    if (!session) redirect("/login");

    const termine = await db.termin.findMany({
        include: {
            patient: { select: { name: true } },
            arzt: { select: { name: true } },
        },
        orderBy: [{ datum: "desc" }, { uhrzeit: "asc" }],
    });

    const aerzte = await db.personal.findMany({
        where: { rolle: "ARZT", verfuegbar: true },
        select: { id: true, name: true },
    });

    const patienten = await db.patient.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Terminverwaltung</h1>
            <TermineClient
                termine={JSON.parse(JSON.stringify(termine))}
                aerzte={aerzte}
                patienten={patienten}
                userRolle={session.user.rolle}
            />
        </div>
    );
}
