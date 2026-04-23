import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Shield } from "lucide-react";

export default async function AuditPage() {
    const session = await auth();
    if (!session) redirect("/login");

    if (session.user.rolle !== "ARZT") {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Shield className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500">Zugriff nur für Ärzte.</p>
            </div>
        );
    }

    const logs = await db.auditLog.findMany({
        include: { user: { select: { name: true, rolle: true } } },
        orderBy: { timestamp: "desc" },
        take: 100,
    });

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Audit-Log</h1>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Zeitpunkt</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Benutzer</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Aktion</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Entität</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                    Noch keine Einträge.
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-500">
                                        {log.timestamp.toLocaleString("de-DE")}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium">{log.user.name}</span>
                                        <span className="ml-1 text-xs text-gray-400">({log.user.rolle})</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${log.action === "CREATE" ? "bg-green-100 text-green-700" :
                                                log.action === "UPDATE" ? "bg-blue-100 text-blue-700" :
                                                    log.action === "DELETE" ? "bg-red-100 text-red-700" :
                                                        "bg-gray-100 text-gray-700"
                                            }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{log.entity}</td>
                                    <td className="px-4 py-3 text-gray-500">{log.details || "–"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
