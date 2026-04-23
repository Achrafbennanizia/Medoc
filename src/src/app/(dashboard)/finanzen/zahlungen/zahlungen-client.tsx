"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createZahlung, updateZahlungStatus } from "@/actions/zahlungen";
import { SuccessMessage, ErrorMessage } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import type { Rolle } from "@/types";

type ZahlungItem = {
    id: string;
    betrag: number;
    zahlungsart: string;
    status: string;
    beschreibung: string | null;
    createdAt: string;
    patient: { name: string };
    leistung: { name: string } | null;
};

interface Props {
    zahlungen: ZahlungItem[];
    patienten: { id: string; name: string }[];
    leistungen: { id: string; name: string; preis: number }[];
    userRolle: Rolle;
}

export function ZahlungenClient({ zahlungen, patienten, leistungen, userRolle }: Props) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [betrag, setBetrag] = useState("");

    function handleLeistungChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const l = leistungen.find((l) => l.id === e.target.value);
        if (l) setBetrag(String(l.preis));
    }

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const form = new FormData(e.currentTarget);

        const result = await createZahlung({
            patientId: form.get("patientId") as string,
            betrag: Number(form.get("betrag")),
            zahlungsart: form.get("zahlungsart") as "BAR" | "KARTE" | "UEBERWEISUNG",
            beschreibung: (form.get("beschreibung") as string) || undefined,
            leistungId: (form.get("leistungId") as string) || undefined,
        });

        if (result.success) {
            setShowForm(false);
            setSuccess("Zahlung erfasst.");
            router.refresh();
        } else {
            setError(result.error);
        }
    }

    async function handleStatusChange(id: string, status: string) {
        const result = await updateZahlungStatus(id, status as never);
        if (result.success) {
            setSuccess("Status aktualisiert.");
            router.refresh();
        }
    }

    const total = zahlungen
        .filter((z) => z.status === "BEZAHLT")
        .reduce((s, z) => s + z.betrag, 0);

    const offen = zahlungen
        .filter((z) => z.status === "OFFEN")
        .reduce((s, z) => s + z.betrag, 0);

    return (
        <div>
            {success && <SuccessMessage message={success} onClose={() => setSuccess("")} />}
            {error && <ErrorMessage message={error} />}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-500">Bezahlt</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(total)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-500">Offen</p>
                    <p className="text-2xl font-bold text-amber-700">{formatCurrency(offen)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-500">Gesamt</p>
                    <p className="text-2xl font-bold">{formatCurrency(total + offen)}</p>
                </div>
            </div>

            {["ARZT", "REZEPTION"].includes(userRolle) && (
                <div className="mb-4 flex justify-end">
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" /> Neue Zahlung
                    </button>
                </div>
            )}

            <Dialog open={showForm} onClose={() => setShowForm(false)} title="Neue Zahlung">
                <form onSubmit={handleCreate} className="space-y-4">
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Leistung (optional)</label>
                        <select name="leistungId" onChange={handleLeistungChange} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                            <option value="">Keine Leistung</option>
                            {leistungen.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name} – {formatCurrency(l.preis)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Betrag (€)</label>
                            <input name="betrag" type="number" step="0.01" required value={betrag} onChange={(e) => setBetrag(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Zahlungsart</label>
                            <select name="zahlungsart" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                                <option value="BAR">Bar</option>
                                <option value="KARTE">Karte</option>
                                <option value="UEBERWEISUNG">Überweisung</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                        <input name="beschreibung" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Abbrechen</button>
                        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Erfassen</button>
                    </div>
                </form>
            </Dialog>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Datum</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Patient</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Leistung</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">Betrag</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Art</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {zahlungen.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Keine Zahlungen.</td>
                            </tr>
                        ) : (
                            zahlungen.map((z) => (
                                <tr key={z.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">{new Date(z.createdAt).toLocaleDateString("de-DE")}</td>
                                    <td className="px-4 py-3 font-medium">{z.patient.name}</td>
                                    <td className="px-4 py-3">{z.leistung?.name || "–"}</td>
                                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(z.betrag)}</td>
                                    <td className="px-4 py-3">{z.zahlungsart}</td>
                                    <td className="px-4 py-3">
                                        <select
                                            value={z.status}
                                            onChange={(e) => handleStatusChange(z.id, e.target.value)}
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 ${z.status === "BEZAHLT" ? "bg-green-100 text-green-700" :
                                                    z.status === "OFFEN" ? "bg-yellow-100 text-yellow-700" :
                                                        "bg-red-100 text-red-700"
                                                }`}
                                        >
                                            <option value="OFFEN">Offen</option>
                                            <option value="BEZAHLT">Bezahlt</option>
                                            <option value="STORNIERT">Storniert</option>
                                        </select>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
