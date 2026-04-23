import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PersonalClient } from "./personal-client";

export default async function PersonalPage() {
    const session = await auth();
    if (!session) redirect("/login");

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

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Personalverwaltung</h1>
            <PersonalClient
                personal={JSON.parse(JSON.stringify(personal))}
                userRolle={session.user.rolle}
            />
        </div>
    );
}
