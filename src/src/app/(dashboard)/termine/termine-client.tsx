"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTermin, updateTermin, deleteTermin } from "@/actions/termine";
import { ConfirmDialog, SuccessMessage, ErrorMessage } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import type { Rolle } from "@/types";

type TerminItem = {
    id: string;
    datum: string;
    uhrzeit: string;
    art: string;
    status: string;
    beschwerden: string | null;
    patientId: string;
    arztId: string;
    patient: { name: string };
    arzt: { name: string };
};

interface Props {
    termine: TerminItem[];
    aerzte: { id: string; name: string }[];
    patienten: { id: string; name: string }[];
    userRolle: Rolle;
}

const statusColors: Record<string, string> = {
    ANGEFRAGT: "bg-yellow-100 text-yellow-700",
    BESTAETIGT: "bg-green-100 text-green-700",
    DURCHGEFUEHRT: "bg-blue-100 text-blue-700",
    ABGESCHLOSSEN: "bg-gray-100 text-gray-700",
    STORNIERT: "bg-red-100 text-red-700",
};

export function TermineClient({ termine, aerzte, patienten, userRolle }: Props) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const form = new FormData(e.currentTarget);

        const result = await createTermin({
            datum: new Date(form.get("datum") as string),
            uhrzeit: form.get("uhrzeit") as string,
            art: form.get("art") as "UNTERSUCHUNG" | "BEHANDLUNG" | "NOTFALL",
            patientId: form.get("patientId") as string,
            arztId: form.get("arztId") as string,
            beschwerden: (form.get("beschwerden") as string) || undefined,
        });

        if (result.success) {
            setShowForm(false);
            setSuccess("Termin erfolgreich angelegt.");
            router.refresh();
        } else {
            setError(result.error);
        }
    }

    async function handleStatusChange(id: string, status: string) {
        const result = await updateTermin(id, { status: status as never });
        if (result.success) {
            setSuccess("Status aktualisiert.");
            router.refresh();
        }
    }

    async function handleDelete() {
        if (!deleteId) return;
        const result = await deleteTermin(deleteId);
        if (result.success) {
            setDeleteId(null);
            setSuccess("Termin gelöscht.");
            router.refresh();
        }
    }

    return (
        <div>
            {success && <SuccessMessage message={success} onClose={() => setSuccess("")} />}
            {error && <ErrorMessage message={error} />}

            <div className="mb-4 flex justify-end">
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4" /> Neuer Termin
                </button>
            </div>

            <Dialog open={showForm} onClose={() => setShowForm(false)} title="Neuer Termin">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                            <input name="datum" type="date" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit</label>
                            <input name="uhrzeit" type="time" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                        <select name="patientId" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                            <option value="">Bitte wählen...</option>
                            {patienten.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Arzt</label>
                        <select name="arztId" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                            <option value="">Bitte wählen...</option>
                            {aerzte.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Art</label>
                        <select name="art" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                            <option value="UNTERSUCHUNG">Untersuchung</option>
                            <option value="BEHANDLUNG">Behandlung</option>
                            <option value="NOTFALL">Notfall</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Beschwerden</label>
                        <textarea name="beschwerden" rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Abbrechen</button>
                        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Speichern</button>
                    </div>
                </form>
            </Dialog>

            {/* Termine List */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Datum</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Uhrzeit</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Patient</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Arzt</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Art</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {termine.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                    Noch keine Termine vorhanden.
                                </td>
                            </tr>
                        ) : (
                            termine.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">{new Date(t.datum).toLocaleDateString("de-DE")}</td>
                                    <td className="px-4 py-3">{t.uhrzeit}</td>
                                    <td className="px-4 py-3 font-medium">{t.patient.name}</td>
                                    <td className="px-4 py-3">{t.arzt.name}</td>
                                    <td className="px-4 py-3">{t.art}</td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={t.status}
                                            onChange={(e) => handleStatusChange(t.id, e.target.value)}
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 ${statusColors[t.status] || "bg-gray-100"}`}
                                        >
                                            <option value="ANGEFRAGT">Angefragt</option>
                                            <option value="BESTAETIGT">Bestätigt</option>
                                            <option value="DURCHGEFUEHRT">Durchgeführt</option>
                                            <option value="ABGESCHLOSSEN">Abgeschlossen</option>
                                            <option value="STORNIERT">Storniert</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {userRolle === "ARZT" && (
                                            <button
                                                onClick={() => setDeleteId(t.id)}
                                                className="text-xs text-red-600 hover:underline"
                                            >
                                                Löschen
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                open={!!deleteId}
                title="Termin löschen"
                message="Möchten Sie diesen Termin wirklich löschen?"
                confirmLabel="Löschen"
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}
