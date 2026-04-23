"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#d97706"];

interface Props {
    patientenProMonat: { monat: string; anzahl: number }[];
    termineNachArt: { art: string; anzahl: number }[];
    einnahmenProMonat: { monat: string; einnahmen: number }[];
}

export function StatistikClient({
    patientenProMonat,
    termineNachArt,
    einnahmenProMonat,
}: Props) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Neue Patienten */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Neue Patienten pro Monat
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={patientenProMonat}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="monat" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="anzahl" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Termine nach Art */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Termine nach Art
                </h3>
                {termineNachArt.length === 0 ? (
                    <p className="text-sm text-gray-500 py-12 text-center">Keine Daten</p>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={termineNachArt}
                                dataKey="anzahl"
                                nameKey="art"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                label={({ art, anzahl }: any) => `${art}: ${anzahl}`}
                            >
                                {termineNachArt.map((_, idx) => (
                                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Einnahmen */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 lg:col-span-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Einnahmen pro Monat (€)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={einnahmenProMonat}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="monat" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any) =>
                                new Intl.NumberFormat("de-DE", {
                                    style: "currency",
                                    currency: "EUR",
                                }).format(value)
                            }
                        />
                        <Line
                            type="monotone"
                            dataKey="einnahmen"
                            stroke="#16a34a"
                            strokeWidth={2}
                            dot={{ fill: "#16a34a" }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
