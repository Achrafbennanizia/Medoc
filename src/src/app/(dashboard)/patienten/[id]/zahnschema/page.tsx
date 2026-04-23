import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DentalChart } from "@/components/zahnschema/dental-chart";

export default async function ZahnschemaPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await auth();
    if (!session) redirect("/login");

    const { id } = await params;

    const patient = await db.patient.findUnique({
        where: { id },
        include: {
            akte: {
                include: { zahnbefunde: true },
            },
        },
    });

    if (!patient || !patient.akte) redirect(`/patienten/${id}`);

    return (
        <div>
            <h1 className="text-2xl font-bold mb-2">Zahnschema – {patient.name}</h1>
            <p className="text-sm text-gray-500 mb-6">FDI-Zahnschema (Fédération Dentaire Internationale)</p>
            <DentalChart
                akteId={patient.akte!.id}
                befunde={JSON.parse(JSON.stringify(patient.akte!.zahnbefunde))}
                canEdit={session.user.rolle === "ARZT"}
            />
        </div>
    );
}
