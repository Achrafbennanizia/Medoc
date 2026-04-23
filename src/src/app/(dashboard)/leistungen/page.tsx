import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LeistungenClient } from "./leistungen-client";

export default async function LeistungenPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const leistungen = await db.leistung.findMany({
        orderBy: [{ kategorie: "asc" }, { name: "asc" }],
    });

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Leistungskatalog</h1>
            <LeistungenClient
                leistungen={JSON.parse(JSON.stringify(leistungen))}
                userRolle={session.user.rolle}
            />
        </div>
    );
}
