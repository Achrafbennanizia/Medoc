import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Calendar, Users, CreditCard, ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
    const session = await auth();
    if (!session) redirect("/login");

    const [patientenCount, termineHeute, offeneZahlungen, leistungenCount] =
        await Promise.all([
            db.patient.count(),
            db.termin.count({
                where: {
                    datum: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        lt: new Date(new Date().setHours(23, 59, 59, 999)),
                    },
                    status: { in: ["ANGEFRAGT", "BESTAETIGT"] },
                },
            }),
            db.zahlung.count({ where: { status: "OFFEN" } }),
            db.leistung.count({ where: { aktiv: true } }),
        ]);

    const stats = [
        {
            label: "Patienten",
            value: patientenCount,
            icon: Users,
            href: "/patienten",
            color: "bg-blue-50 text-blue-700",
        },
        {
            label: "Termine heute",
            value: termineHeute,
            icon: Calendar,
            href: "/termine",
            color: "bg-green-50 text-green-700",
        },
        {
            label: "Offene Zahlungen",
            value: offeneZahlungen,
            icon: CreditCard,
            href: "/finanzen/zahlungen",
            color: "bg-amber-50 text-amber-700",
        },
        {
            label: "Leistungen",
            value: leistungenCount,
            icon: ClipboardList,
            href: "/leistungen",
            color: "bg-purple-50 text-purple-700",
        },
    ];

    const recentTermine = await db.termin.findMany({
        take: 5,
        orderBy: { datum: "desc" },
        include: { patient: true, arzt: true },
    });

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">
                Willkommen, {session.user.name}
            </h1>

            {/* Statistik-Karten */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Link
                            key={stat.label}
                            href={stat.href}
                            className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">{stat.label}</p>
                                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                                </div>
                                <div className={`rounded-lg p-3 ${stat.color}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Letzte Termine */}
            <div className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 p-5">
                    <h2 className="text-lg font-semibold">Letzte Termine</h2>
                    <Link
                        href="/termine"
                        className="text-sm text-blue-600 hover:underline"
                    >
                        Alle anzeigen →
                    </Link>
                </div>
                <div className="divide-y divide-gray-100">
                    {recentTermine.length === 0 ? (
                        <p className="p-5 text-sm text-gray-500">
                            Noch keine Termine vorhanden.
                        </p>
                    ) : (
                        recentTermine.map((termin) => (
                            <div
                                key={termin.id}
                                className="flex items-center justify-between p-4 hover:bg-gray-50"
                            >
                                <div>
                                    <p className="font-medium">{termin.patient.name}</p>
                                    <p className="text-sm text-gray-500">
                                        {new Date(termin.datum).toLocaleDateString("de-DE")} –{" "}
                                        {termin.uhrzeit} Uhr
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500">
                                        Dr. {termin.arzt.name}
                                    </span>
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${termin.status === "BESTAETIGT"
                                                ? "bg-green-100 text-green-700"
                                                : termin.status === "ANGEFRAGT"
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : termin.status === "STORNIERT"
                                                        ? "bg-red-100 text-red-700"
                                                        : "bg-gray-100 text-gray-700"
                                            }`}
                                    >
                                        {termin.status}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
