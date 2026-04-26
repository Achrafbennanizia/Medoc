import { useState } from "react";
import { Card, CardHeader } from "./ui/card";
import { type AnamneseV1, anamneseLabelFor } from "@/lib/anamnese";

function EntryList({ entries }: { entries: [string, string][] }) {
    const rows = entries.filter(([, v]) => v && String(v).trim());
    if (rows.length === 0) {
        return <p style={{ margin: 0, fontSize: 13, color: "var(--fg-4)", fontStyle: "italic" }}>Keine Einträge.</p>;
    }
    return (
        <dl style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0 }}>
            {rows.map(([k, v]) => (
                <div key={k} className="row" style={{ alignItems: "flex-start", gap: 12, justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--fg-3)", fontSize: 12, fontWeight: 600, minWidth: 140 }}>{anamneseLabelFor(k)}</dt>
                    <dd style={{ margin: 0, textAlign: "right", flex: 1, fontSize: 13.5 }}>{v}</dd>
                </div>
            ))}
        </dl>
    );
}

type AccSection = { id: string; title: string; entries: [string, string][] };

export function AnamneseVisual({ data }: { data: AnamneseV1 }) {
    const vor = data.vorerkrankungen && typeof data.vorerkrankungen === "object" ? Object.entries(data.vorerkrankungen) : [];
    const med = data.medikation && typeof data.medikation === "object" ? Object.entries(data.medikation) : [];
    const all = data.allergien && typeof data.allergien === "object" ? Object.entries(data.allergien) : [];

    const stamm: [string, string][] = [
        ["versicherungsstatus", data.versicherungsstatus ?? ""],
        ["krankenkasse", data.krankenkasse ?? ""],
    ];

    const sections: AccSection[] = [
        { id: "stamm", title: "Versicherung & Zuordnung", entries: stamm },
        { id: "vor", title: "Vorerkrankungen & Anamnese", entries: vor },
        { id: "med", title: "Medikation", entries: med },
        { id: "all", title: "Allergien & Unverträglichkeiten", entries: all },
    ];

    const [openId, setOpenId] = useState<string | null>("stamm");

    return (
        <div className="col" style={{ gap: 0 }}>
            {sections.map((s) => {
                const isOpen = openId === s.id;
                return (
                    <div key={s.id} className={`anam-acc-item ${isOpen ? "is-open" : ""}`}>
                        <button
                            type="button"
                            className="anam-acc-trigger"
                            aria-expanded={isOpen}
                            onClick={() => setOpenId(isOpen ? null : s.id)}
                        >
                            <span>{s.title}</span>
                            <span className="anam-acc-chev" aria-hidden>
                                ▸
                            </span>
                        </button>
                        {isOpen ? (
                            <div className="anam-acc-body">
                                <EntryList entries={s.entries} />
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

/** Read-only cards (legacy layout) — retained if needed elsewhere. */
export function AnamneseVisualFlat({ data }: { data: AnamneseV1 }) {
    const vor = data.vorerkrankungen && typeof data.vorerkrankungen === "object" ? Object.entries(data.vorerkrankungen) : [];
    const med = data.medikation && typeof data.medikation === "object" ? Object.entries(data.medikation) : [];
    const all = data.allergien && typeof data.allergien === "object" ? Object.entries(data.allergien) : [];
    const stamm: [string, string][] = [
        ["versicherungsstatus", data.versicherungsstatus ?? ""],
        ["krankenkasse", data.krankenkasse ?? ""],
    ];
    return (
        <div className="col" style={{ gap: 16 }}>
            <Card className="card-pad">
                <CardHeader title="Versicherung & Zuordnung" />
                <EntryList entries={stamm} />
            </Card>
            <Card className="card-pad">
                <CardHeader title="Vorerkrankungen & Anamnese" />
                <EntryList entries={vor} />
            </Card>
            <Card className="card-pad">
                <CardHeader title="Medikation" />
                <EntryList entries={med} />
            </Card>
            <Card className="card-pad">
                <CardHeader title="Allergien & Unverträglichkeiten" />
                <EntryList entries={all} />
            </Card>
        </div>
    );
}
