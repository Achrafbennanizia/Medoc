import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AnamnesebogenClient } from "./anamnesebogen-client";

const standardFragen = [
    "Haben Sie Herz-Kreislauf-Erkrankungen?",
    "Nehmen Sie regelmäßig Medikamente ein?",
    "Haben Sie Allergien oder Unverträglichkeiten?",
    "Sind Sie Diabetiker?",
    "Leiden Sie an einer Blutgerinnungsstörung?",
    "Hatten Sie in der Vergangenheit Probleme bei einer Narkose?",
    "Sind Sie schwanger oder stillen Sie?",
    "Rauchen Sie?",
    "Haben Sie aktuell Zahnschmerzen?",
    "Wann war Ihr letzter Zahnarztbesuch?",
];

export default async function AnamnesebogenPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await auth();
    if (!session) redirect("/login");

    const { id } = await params;

    const patient = await db.patient.findUnique({
        where: { id },
        include: { anamnesebogen: true },
    });

    if (!patient) redirect("/patienten");

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">
                Anamnesebogen – {patient.name}
            </h1>
            <AnamnesebogenClient
                patientId={id}
                fragen={standardFragen}
                existing={patient.anamnesebogen ? JSON.parse(JSON.stringify(patient.anamnesebogen)) : null}
                canEdit={["ARZT", "REZEPTION"].includes(session.user.rolle)}
            />
        </div>
    );
}
