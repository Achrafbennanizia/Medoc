import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { StatistikClient } from "./statistik-client";

export default async function StatistikPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const now = new Date();
    const jahr = now.getFullYear();

    // Patienten pro Monat
    const patienten = await db.patient.findMany({
        select: { createdAt: true },
        where: {
            createdAt: {
                gte: new Date(jahr, 0, 1),
                lt: new Date(jahr + 1, 0, 1),
            },
        },
    });

    const patientenProMonat: { monat: string; anzahl: number }[] = [];
    for (let m = 0; m < 12; m++) {
        const key = `${String(m + 1).padStart(2, "0")}/${jahr}`;
        const count = patienten.filter(
            (p) => p.createdAt.getMonth() === m
        ).length;
        patientenProMonat.push({ monat: key, anzahl: count });
    }

    // Termine nach Art
    const termineNachArt = await db.termin.groupBy({
        by: ["art"],
        _count: { id: true },
    });

    // Einnahmen pro Monat
    const zahlungen = await db.zahlung.findMany({
        where: {
            status: "BEZAHLT",
            createdAt: {
                gte: new Date(jahr, 0, 1),
                lt: new Date(jahr + 1, 0, 1),
            },
        },
    });

    const einnahmenProMonat: { monat: string; einnahmen: number }[] = [];
    for (let m = 0; m < 12; m++) {
        const key = `${String(m + 1).padStart(2, "0")}/${jahr}`;
        const sum = zahlungen
            .filter((z) => z.createdAt.getMonth() === m)
            .reduce((s, z) => s + z.betrag, 0);
        einnahmenProMonat.push({ monat: key, einnahmen: sum });
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Statistiken</h1>
            <StatistikClient
                patientenProMonat={patientenProMonat}
                termineNachArt={termineNachArt.map((t) => ({
                    art: t.art,
                    anzahl: t._count.id,
                }))}
                einnahmenProMonat={einnahmenProMonat}
            />
        </div>
    );
}
