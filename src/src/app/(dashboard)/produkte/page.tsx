import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ProdukteClient } from "./produkte-client";

export default async function ProduktePage() {
    const session = await auth();
    if (!session) redirect("/login");

    const produkte = await db.produkt.findMany({
        orderBy: { name: "asc" },
    });

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Produkte & Bestellungen</h1>
            <ProdukteClient
                produkte={JSON.parse(JSON.stringify(produkte))}
                userRolle={session.user.rolle}
            />
        </div>
    );
}
