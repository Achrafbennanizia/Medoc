"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createLeistung } from "@/actions/leistungen";
import { SuccessMessage, ErrorMessage } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { DataTable } from "@/components/tables/data-table";
import { formatCurrency } from "@/lib/utils";
import type { Rolle } from "@/types";

type LeistungItem = {
    id: string;
    name: string;
    kategorie: string;
    preis: number;
    aktiv: boolean;
};

interface Props {
    leistungen: LeistungItem[];
    userRolle: Rolle;
}

export function LeistungenClient({ leistungen, userRolle }: Props) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const form = new FormData(e.currentTarget);

        const result = await createLeistung({
            name: form.get("name") as string,
            kategorie: form.get("kategorie") as string,
            preis: Number(form.get("preis")),
        });

        if (result.success) {
            setShowForm(false);
            setSuccess("Leistung angelegt.");
            router.refresh();
        } else {
            setError(result.error);
        }
    }

    const columns = [
        { key: "name", label: "Bezeichnung", render: (l: LeistungItem) => <span className="font-medium">{l.name}</span> },
        { key: "kategorie", label: "Kategorie" },
        {
            key: "preis",
            label: "Preis",
            render: (l: LeistungItem) => formatCurrency(l.preis),
        },
        {
            key: "aktiv",
            label: "Status",
            render: (l: LeistungItem) => (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.aktiv ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                    {l.aktiv ? "Aktiv" : "Inaktiv"}
                </span>
            ),
        },
    ];

    return (
        <div>
            {success && <SuccessMessage message={success} onClose={() => setSuccess("")} />}
            {error && <ErrorMessage message={error} />}

            {userRolle === "ARZT" && (
                <div className="mb-4 flex justify-end">
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" /> Neue Leistung
                    </button>
                </div>
            )}

            <Dialog open={showForm} onClose={() => setShowForm(false)} title="Neue Leistung" className="max-w-md">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
                        <input name="name" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                        <input name="kategorie" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="z.B. Prophylaxe, Chirurgie, Prothetik" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preis (€)</label>
                        <input name="preis" type="number" step="0.01" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Abbrechen</button>
                        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Speichern</button>
                    </div>
                </form>
            </Dialog>

            <DataTable data={leistungen} columns={columns} searchPlaceholder="Leistung suchen..." />
        </div>
    );
}
