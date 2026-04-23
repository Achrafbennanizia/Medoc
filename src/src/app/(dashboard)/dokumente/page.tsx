import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

export default async function DokumentePage() {
    const session = await auth();
    if (!session) redirect("/login");

    return (
        <div>
            <h1 className="text-2xl font-bold mb-2">Dokumente</h1>
            <p className="text-gray-500 mb-6">Zentrale Ablage für Schreiben, Einwilligungen und Scans.</p>
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-600">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" aria-hidden />
                <p className="text-sm max-w-md mx-auto">
                    Die Dokumentenverwaltung wird hier angebunden — bis dahin nutzen Sie bitte die Patientenakte oder Ihr DMS.
                </p>
            </div>
        </div>
    );
}
