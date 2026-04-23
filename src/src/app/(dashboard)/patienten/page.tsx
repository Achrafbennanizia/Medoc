import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PatientenClient } from "./patienten-client";

export default async function PatientenPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const patienten = await db.patient.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: { select: { termine: true, zahlungen: true } },
        },
    });

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Patienten</h1>
            <PatientenClient
                patienten={JSON.parse(JSON.stringify(patienten))}
            />
        </div>
    );
}
