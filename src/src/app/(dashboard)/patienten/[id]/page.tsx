import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function PatientDetailPage({
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
                include: {
                    untersuchungen: { orderBy: { createdAt: "desc" }, take: 5 },
                    behandlungen: {
                        orderBy: { createdAt: "desc" },
                        take: 5,
                        include: { leistung: true },
                    },
                    zahnbefunde: true,
                    dokumente: { orderBy: { createdAt: "desc" }, take: 10 },
                },
            },
            termine: {
                orderBy: { datum: "desc" },
                take: 10,
                include: { arzt: { select: { name: true } } },
            },
            zahlungen: {
                orderBy: { createdAt: "desc" },
                take: 10,
                include: { leistung: { select: { name: true } } },
            },
            anamnesebogen: true,
        },
    });

    if (!patient) redirect("/patienten");

    const statusColors: Record<string, string> = {
        ANGEFRAGT: "bg-yellow-100 text-yellow-700",
        BESTAETIGT: "bg-green-100 text-green-700",
        DURCHGEFUEHRT: "bg-blue-100 text-blue-700",
        ABGESCHLOSSEN: "bg-gray-100 text-gray-700",
        STORNIERT: "bg-red-100 text-red-700",
        BEZAHLT: "bg-green-100 text-green-700",
        OFFEN: "bg-yellow-100 text-yellow-700",
    };

    return (
        <div>
            {/* Patient Header */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">{patient.name}</h1>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                            <span>Geb.: {patient.geburtsdatum.toLocaleDateString("de-DE")}</span>
                            <span>Geschlecht: {patient.geschlecht}</span>
                            <span>Vers.-Nr.: {patient.versicherungsnummer}</span>
                            {patient.telefon && <span>Tel.: {patient.telefon}</span>}
                            {patient.email && <span>E-Mail: {patient.email}</span>}
                        </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${patient.status === "AKTIV" ? "bg-green-100 text-green-700" :
                            patient.status === "NEU" ? "bg-blue-100 text-blue-700" :
                                "bg-gray-100 text-gray-700"
                        }`}>
                        {patient.status}
                    </span>
                </div>
                <div className="mt-4 flex gap-3">
                    <Link
                        href={`/patienten/${id}/zahnschema`}
                        className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    >
                        Zahnschema
                    </Link>
                    <Link
                        href={`/patienten/${id}/anamnesebogen`}
                        className="rounded-lg bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
                    >
                        Anamnesebogen
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Termine */}
                <div className="rounded-xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-200 p-4">
                        <h2 className="font-semibold">Letzte Termine</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {patient.termine.length === 0 ? (
                            <p className="p-4 text-sm text-gray-500">Keine Termine.</p>
                        ) : (
                            patient.termine.map((t) => (
                                <div key={t.id} className="flex items-center justify-between p-4">
                                    <div>
                                        <p className="text-sm font-medium">
                                            {t.datum.toLocaleDateString("de-DE")} – {t.uhrzeit}
                                        </p>
                                        <p className="text-xs text-gray-500">{t.art} bei {t.arzt.name}</p>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[t.status] || ""}`}>
                                        {t.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Zahlungen */}
                <div className="rounded-xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-200 p-4">
                        <h2 className="font-semibold">Zahlungen</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {patient.zahlungen.length === 0 ? (
                            <p className="p-4 text-sm text-gray-500">Keine Zahlungen.</p>
                        ) : (
                            patient.zahlungen.map((z) => (
                                <div key={z.id} className="flex items-center justify-between p-4">
                                    <div>
                                        <p className="text-sm font-medium">
                                            {z.betrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {z.zahlungsart} {z.leistung ? `– ${z.leistung.name}` : ""}
                                        </p>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[z.status] || ""}`}>
                                        {z.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Untersuchungen */}
                <div className="rounded-xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-200 p-4">
                        <h2 className="font-semibold">Untersuchungen</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {(!patient.akte || patient.akte.untersuchungen.length === 0) ? (
                            <p className="p-4 text-sm text-gray-500">Keine Untersuchungen.</p>
                        ) : (
                            patient.akte.untersuchungen.map((u) => (
                                <div key={u.id} className="p-4">
                                    <p className="text-sm font-medium">{u.beschwerden}</p>
                                    {u.diagnose && <p className="text-xs text-gray-600 mt-1">Diagnose: {u.diagnose}</p>}
                                    <p className="text-xs text-gray-400 mt-1">
                                        {u.createdAt.toLocaleDateString("de-DE")}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Behandlungen */}
                <div className="rounded-xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-200 p-4">
                        <h2 className="font-semibold">Behandlungen</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {(!patient.akte || patient.akte.behandlungen.length === 0) ? (
                            <p className="p-4 text-sm text-gray-500">Keine Behandlungen.</p>
                        ) : (
                            patient.akte.behandlungen.map((b) => (
                                <div key={b.id} className="p-4">
                                    <p className="text-sm font-medium">{b.behandlungsart}</p>
                                    {b.verlauf && <p className="text-xs text-gray-600 mt-1">{b.verlauf}</p>}
                                    {b.leistung && (
                                        <p className="text-xs text-blue-600 mt-1">Leistung: {b.leistung.name}</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">
                                        {b.createdAt.toLocaleDateString("de-DE")}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
