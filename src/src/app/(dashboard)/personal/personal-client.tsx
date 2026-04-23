"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPersonal } from "@/actions/personal";
import { SuccessMessage, ErrorMessage } from "@/components/ui/shared";
import { Dialog } from "@/components/ui/dialog";
import { DataTable } from "@/components/tables/data-table";
import type { Rolle } from "@/types";

type PersonalItem = {
    id: string;
    name: string;
    email: string;
    rolle: string;
    taetigkeitsbereich: string | null;
    fachrichtung: string | null;
    telefon: string | null;
    verfuegbar: boolean;
};

interface Props {
    personal: PersonalItem[];
    userRolle: Rolle;
}

const rolleColors: Record<string, string> = {
    ARZT: "bg-blue-100 text-blue-700",
    REZEPTION: "bg-green-100 text-green-700",
    STEUERBERATER: "bg-purple-100 text-purple-700",
    PHARMABERATER: "bg-amber-100 text-amber-700",
};

export function PersonalClient({ personal, userRolle }: Props) {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const form = new FormData(e.currentTarget);

        const result = await createPersonal({
            name: form.get("name") as string,
            email: form.get("email") as string,
            passwort: form.get("passwort") as string,
            rolle: form.get("rolle") as "ARZT" | "REZEPTION" | "STEUERBERATER" | "PHARMABERATER",
            taetigkeitsbereich: (form.get("taetigkeitsbereich") as string) || undefined,
            fachrichtung: (form.get("fachrichtung") as string) || undefined,
            telefon: (form.get("telefon") as string) || undefined,
        });

        if (result.success) {
            setShowForm(false);
            setSuccess("Personal angelegt.");
            router.refresh();
        } else {
            setError(result.error);
        }
    }

    const columns = [
        { key: "name", label: "Name", render: (p: PersonalItem) => <span className="font-medium">{p.name}</span> },
        { key: "email", label: "E-Mail" },
        {
            key: "rolle",
            label: "Rolle",
            render: (p: PersonalItem) => (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${rolleColors[p.rolle] || ""}`}>
                    {p.rolle}
                </span>
            ),
        },
        { key: "telefon", label: "Telefon", render: (p: PersonalItem) => p.telefon || "–" },
        {
            key: "verfuegbar",
            label: "Verfügbar",
            render: (p: PersonalItem) => (
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${p.verfuegbar ? "bg-green-500" : "bg-gray-300"}`} />
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
                        <Plus className="h-4 w-4" /> Neues Personal
                    </button>
                </div>
            )}

            <Dialog open={showForm} onClose={() => setShowForm(false)} title="Neues Personal">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input name="name" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                            <input name="email" type="email" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                            <input name="passwort" type="password" required minLength={8} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
                        <select name="rolle" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                            <option value="ARZT">Arzt</option>
                            <option value="REZEPTION">Rezeption</option>
                            <option value="STEUERBERATER">Steuerberater</option>
                            <option value="PHARMABERATER">Pharmaberater</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tätigkeitsbereich</label>
                            <input name="taetigkeitsbereich" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fachrichtung</label>
                            <input name="fachrichtung" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                        <input name="telefon" type="tel" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Abbrechen</button>
                        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Speichern</button>
                    </div>
                </form>
            </Dialog>

            <DataTable data={personal} columns={columns} searchPlaceholder="Personal suchen..." />
        </div>
    );
}
