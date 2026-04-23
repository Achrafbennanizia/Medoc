"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createProdukt } from "@/actions/produkte";
import { SuccessMessage, ErrorMessage } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { DataTable } from "@/components/tables/data-table";
import type { Rolle } from "@/types";

type ProduktItem = {
    id: string;
    name: string;
    lieferant: string;
    menge: number;
    lieferstatus: string;
    hersteller: string | null;
    preis: number | null;
};

interface Props {
    produkte: ProduktItem[];
    userRolle: Rolle;
}

const statusColors: Record<string, string> = {
    BESTELLT: "bg-yellow-100 text-yellow-700",
    GELIEFERT: "bg-green-100 text-green-700",
    STORNIERT: "bg-red-100 text-red-700",
};

export function ProdukteClient({ produkte, userRolle }: Props) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const form = new FormData(e.currentTarget);

        const result = await createProdukt({
            name: form.get("name") as string,
            lieferant: form.get("lieferant") as string,
            menge: Number(form.get("menge")),
            hersteller: (form.get("hersteller") as string) || undefined,
            preis: form.get("preis") ? Number(form.get("preis")) : undefined,
        });

        if (result.success) {
            setShowForm(false);
            setSuccess("Produkt angelegt.");
            router.refresh();
        } else {
            setError(result.error);
        }
    }

    const columns = [
        { key: "name", label: "Produkt", render: (p: ProduktItem) => <span className="font-medium">{p.name}</span> },
        { key: "lieferant", label: "Lieferant" },
        { key: "hersteller", label: "Hersteller", render: (p: ProduktItem) => p.hersteller || "–" },
        { key: "menge", label: "Menge" },
        {
            key: "lieferstatus",
            label: "Status",
            render: (p: ProduktItem) => (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[p.lieferstatus] || ""}`}>
                    {p.lieferstatus}
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
                    <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                        <Plus className="h-4 w-4" /> Neues Produkt
                    </button>
                </div>
            )}

            <Dialog open={showForm} onClose={() => setShowForm(false)} title="Neues Produkt" className="max-w-md">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input name="name" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lieferant</label>
                        <input name="lieferant" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Menge</label>
                            <input name="menge" type="number" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Preis (€)</label>
                            <input name="preis" type="number" step="0.01" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hersteller</label>
                        <input name="hersteller" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Abbrechen</button>
                        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Speichern</button>
                    </div>
                </form>
            </Dialog>

            <DataTable data={produkte} columns={columns} searchPlaceholder="Produkt suchen..." />
        </div>
    );
}
