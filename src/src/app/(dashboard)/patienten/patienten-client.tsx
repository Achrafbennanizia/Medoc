"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPatient } from "@/actions/patienten";
import { SuccessMessage, ErrorMessage } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { DataTable } from "@/components/tables/data-table";

type PatientItem = {
    id: string;
    name: string;
    geburtsdatum: string;
    geschlecht: string;
    versicherungsnummer: string;
    telefon: string | null;
    status: string;
    _count: { termine: number; zahlungen: number };
};

interface Props {
    patienten: PatientItem[];
}

export function PatientenClient({ patienten }: Props) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const form = new FormData(e.currentTarget);

        const result = await createPatient({
            name: form.get("name") as string,
            geburtsdatum: new Date(form.get("geburtsdatum") as string),
            geschlecht: form.get("geschlecht") as "MAENNLICH" | "WEIBLICH" | "DIVERS",
            versicherungsnummer: form.get("versicherungsnummer") as string,
            telefon: (form.get("telefon") as string) || undefined,
            email: (form.get("email") as string) || undefined,
            adresse: (form.get("adresse") as string) || undefined,
        });

        if (result.success) {
            setShowForm(false);
            setSuccess("Patient erfolgreich angelegt.");
            router.refresh();
        } else {
            setError(result.error);
        }
    }

    const columns = [
        { key: "name", label: "Name", render: (p: PatientItem) => <span className="font-medium">{p.name}</span> },
        {
            key: "geburtsdatum",
            label: "Geburtsdatum",
            render: (p: PatientItem) => new Date(p.geburtsdatum).toLocaleDateString("de-DE"),
        },
        { key: "geschlecht", label: "Geschlecht" },
        { key: "versicherungsnummer", label: "Vers.-Nr." },
        { key: "telefon", label: "Telefon" },
        {
            key: "status",
            label: "Status",
            render: (p: PatientItem) => (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "AKTIV" ? "bg-green-100 text-green-700" :
                        p.status === "NEU" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-700"
                    }`}>
                    {p.status}
                </span>
            ),
        },
        {
            key: "_count",
            label: "Termine",
            render: (p: PatientItem) => p._count.termine,
        },
    ];

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
                    <Plus className="h-4 w-4" /> Neuer Patient
                </button>
            </div>

            <Dialog open={showForm} onClose={() => setShowForm(false)} title="Neuer Patient">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input name="name" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum *</label>
                            <input name="geburtsdatum" type="date" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Geschlecht *</label>
                            <select name="geschlecht" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                                <option value="MAENNLICH">Männlich</option>
                                <option value="WEIBLICH">Weiblich</option>
                                <option value="DIVERS">Divers</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Versicherungsnummer *</label>
                        <input name="versicherungsnummer" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                            <input name="telefon" type="tel" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                            <input name="email" type="email" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                        <input name="adresse" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
                            Abbrechen
                        </button>
                        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                            Speichern
                        </button>
                    </div>
                </form>
            </Dialog>

            <DataTable
                data={patienten}
                columns={columns}
                searchPlaceholder="Patient suchen (Name, Vers.-Nr.)..."
                onRowClick={(p) => router.push(`/patienten/${p.id}`)}
                pageSize={15}
            />
        </div>
    );
}
