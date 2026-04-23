"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAnamnesebogen } from "@/actions/behandlungen";
import { SuccessMessage, ErrorMessage } from "@/components/ui/shared";

interface Props {
    patientId: string;
    fragen: string[];
    existing: {
        antworten: Record<string, string>;
        unterschrieben: boolean;
    } | null;
    canEdit: boolean;
}

export function AnamnesebogenClient({ patientId, fragen, existing, canEdit }: Props) {
    const router = useRouter();
    const [antworten, setAntworten] = useState<Record<string, string>>(
        existing?.antworten || {}
    );
    const [unterschrieben, setUnterschrieben] = useState(
        existing?.unterschrieben || false
    );
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    async function handleSave() {
        const result = await saveAnamnesebogen({
            patientId,
            antworten,
            unterschrieben,
        });

        if (result.success) {
            setSuccess("Anamnesebogen gespeichert.");
            router.refresh();
        } else {
            setError(result.error);
        }
    }

    return (
        <div className="max-w-2xl">
            {success && <SuccessMessage message={success} onClose={() => setSuccess("")} />}
            {error && <ErrorMessage message={error} />}

            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
                {fragen.map((frage, idx) => (
                    <div key={idx}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {idx + 1}. {frage}
                        </label>
                        <textarea
                            value={antworten[frage] || ""}
                            onChange={(e) =>
                                setAntworten((prev) => ({ ...prev, [frage]: e.target.value }))
                            }
                            disabled={!canEdit}
                            rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
                        />
                    </div>
                ))}

                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    <input
                        type="checkbox"
                        id="unterschrieben"
                        checked={unterschrieben}
                        onChange={(e) => setUnterschrieben(e.target.checked)}
                        disabled={!canEdit}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="unterschrieben" className="text-sm font-medium text-gray-700">
                        Patient hat unterschrieben
                    </label>
                </div>

                {canEdit && (
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSave}
                            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            Speichern
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
