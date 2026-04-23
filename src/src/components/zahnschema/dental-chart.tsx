"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateZahnbefund } from "@/actions/behandlungen";
import { SuccessMessage } from "@/components/ui/shared";

// FDI Zahnschema: Oberkiefer 18-11, 21-28 | Unterkiefer 48-41, 31-38
const oberkieferRechts = [18, 17, 16, 15, 14, 13, 12, 11];
const oberkieferLinks = [21, 22, 23, 24, 25, 26, 27, 28];
const unterkieferRechts = [48, 47, 46, 45, 44, 43, 42, 41];
const unterkieferLinks = [31, 32, 33, 34, 35, 36, 37, 38];

const befundOptions = [
    { value: "gesund", label: "Gesund", color: "#22c55e" },
    { value: "karioes", label: "Kariös", color: "#ef4444" },
    { value: "gefuellt", label: "Gefüllt", color: "#3b82f6" },
    { value: "krone", label: "Krone", color: "#a855f7" },
    { value: "bruecke", label: "Brücke", color: "#f59e0b" },
    { value: "fehlend", label: "Fehlend", color: "#6b7280" },
    { value: "implantat", label: "Implantat", color: "#06b6d4" },
    { value: "wurzelbehandlung", label: "Wurzelbehandlung", color: "#ec4899" },
];

type Befund = {
    id: string;
    zahnNummer: number;
    befund: string;
    diagnose: string | null;
    behandlung: string | null;
    notizen: string | null;
};

interface Props {
    akteId: string;
    befunde: Befund[];
    canEdit: boolean;
}

function getBefundColor(befund: string): string {
    return befundOptions.find((b) => b.value === befund)?.color || "#22c55e";
}

function ToothSVG({
    nummer,
    befund,
    isSelected,
    onClick,
}: {
    nummer: number;
    befund: string;
    isSelected: boolean;
    onClick: () => void;
}) {
    const color = getBefundColor(befund);
    const isOber = nummer < 40;

    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center gap-1 group"
            title={`Zahn ${nummer}: ${befund}`}
        >
            {isOber && (
                <span className="text-xs text-gray-500 group-hover:text-gray-800">
                    {nummer}
                </span>
            )}
            <svg
                width="32"
                height="40"
                viewBox="0 0 32 40"
                className={`transition-transform group-hover:scale-110 ${isSelected ? "ring-2 ring-blue-500 rounded" : ""
                    }`}
            >
                {/* Zahnkörper */}
                <rect
                    x="4"
                    y={isOber ? 8 : 2}
                    width="24"
                    height="24"
                    rx="6"
                    fill={color}
                    opacity={befund === "fehlend" ? 0.3 : 0.8}
                    stroke={isSelected ? "#2563eb" : "#d1d5db"}
                    strokeWidth={isSelected ? 2 : 1}
                />
                {/* Wurzel */}
                {befund !== "fehlend" && (
                    <path
                        d={
                            isOber
                                ? "M12 32 L16 38 L20 32"
                                : "M12 8 L16 2 L20 8"
                        }
                        fill={color}
                        opacity={0.5}
                    />
                )}
                {/* Markierung für spezielle Befunde */}
                {befund === "krone" && (
                    <circle cx="16" cy={isOber ? 20 : 14} r="5" fill="white" opacity={0.5} />
                )}
                {befund === "wurzelbehandlung" && (
                    <line
                        x1="10"
                        y1={isOber ? 14 : 8}
                        x2="22"
                        y2={isOber ? 26 : 20}
                        stroke="white"
                        strokeWidth="2"
                        opacity={0.6}
                    />
                )}
            </svg>
            {!isOber && (
                <span className="text-xs text-gray-500 group-hover:text-gray-800">
                    {nummer}
                </span>
            )}
        </button>
    );
}

export function DentalChart({ akteId, befunde, canEdit }: Props) {
    const router = useRouter();
    const [selected, setSelected] = useState<number | null>(null);
    const [selectedBefund, setSelectedBefund] = useState("gesund");
    const [diagnose, setDiagnose] = useState("");
    const [notizen, setNotizen] = useState("");
    const [success, setSuccess] = useState("");

    const befundMap = new Map<number, Befund>();
    for (const b of befunde) {
        befundMap.set(b.zahnNummer, b);
    }

    function handleToothClick(nummer: number) {
        setSelected(nummer);
        const existing = befundMap.get(nummer);
        setSelectedBefund(existing?.befund || "gesund");
        setDiagnose(existing?.diagnose || "");
        setNotizen(existing?.notizen || "");
    }

    async function handleSave() {
        if (!selected) return;
        const result = await updateZahnbefund({
            akteId,
            zahnNummer: selected,
            befund: selectedBefund,
            diagnose: diagnose || undefined,
            notizen: notizen || undefined,
        });

        if (result.success) {
            setSuccess(`Zahn ${selected} aktualisiert.`);
            setSelected(null);
            router.refresh();
        }
    }

    function renderRow(teeth: number[]) {
        return (
            <div className="flex gap-1">
                {teeth.map((nr) => (
                    <ToothSVG
                        key={nr}
                        nummer={nr}
                        befund={befundMap.get(nr)?.befund || "gesund"}
                        isSelected={selected === nr}
                        onClick={() => handleToothClick(nr)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div>
            {success && (
                <SuccessMessage message={success} onClose={() => setSuccess("")} />
            )}

            {/* Legende */}
            <div className="mb-6 flex flex-wrap gap-3">
                {befundOptions.map((b) => (
                    <div key={b.value} className="flex items-center gap-1.5">
                        <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: b.color }}
                        />
                        <span className="text-xs text-gray-600">{b.label}</span>
                    </div>
                ))}
            </div>

            {/* Zahnschema */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex flex-col items-center gap-2">
                    {/* Oberkiefer */}
                    <p className="text-xs font-medium text-gray-500 mb-1">
                        Oberkiefer
                    </p>
                    <div className="flex gap-4">
                        {renderRow(oberkieferRechts)}
                        <div className="w-px bg-gray-300" />
                        {renderRow(oberkieferLinks)}
                    </div>

                    {/* Trennlinie */}
                    <div className="w-full max-w-lg border-t border-gray-300 my-2" />

                    {/* Unterkiefer */}
                    <div className="flex gap-4">
                        {renderRow(unterkieferRechts)}
                        <div className="w-px bg-gray-300" />
                        {renderRow(unterkieferLinks)}
                    </div>
                    <p className="text-xs font-medium text-gray-500 mt-1">
                        Unterkiefer
                    </p>
                </div>
            </div>

            {/* Detail-Panel */}
            {selected && canEdit && (
                <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
                    <h3 className="text-lg font-semibold mb-4">Zahn {selected}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Befund
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {befundOptions.map((b) => (
                                    <button
                                        key={b.value}
                                        onClick={() => setSelectedBefund(b.value)}
                                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${selectedBefund === b.value
                                                ? "text-white"
                                                : "bg-white text-gray-700 border border-gray-300"
                                            }`}
                                        style={
                                            selectedBefund === b.value
                                                ? { backgroundColor: b.color }
                                                : undefined
                                        }
                                    >
                                        {b.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Diagnose
                            </label>
                            <input
                                value={diagnose}
                                onChange={(e) => setDiagnose(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notizen
                            </label>
                            <textarea
                                value={notizen}
                                onChange={(e) => setNotizen(e.target.value)}
                                rows={2}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleSave}
                                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                                Speichern
                            </button>
                            <button
                                onClick={() => setSelected(null)}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                            >
                                Abbrechen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
