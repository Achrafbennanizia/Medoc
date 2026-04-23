import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ZahlungenClient } from "./zahlungen-client";

export default async function ZahlungenPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const zahlungen = await db.zahlung.findMany({
        include: {
            patient: { select: { name: true } },
            leistung: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    const patienten = await db.patient.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });

    const leistungen = await db.leistung.findMany({
        where: { aktiv: true },
        select: { id: true, name: true, preis: true },
        orderBy: { name: "asc" },
    });

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Zahlungen</h1>
            <ZahlungenClient
                zahlungen={JSON.parse(JSON.stringify(zahlungen))}
                patienten={patienten}
                leistungen={JSON.parse(JSON.stringify(leistungen))}
                userRolle={session.user.rolle}
            />
        </div>
    );
}
