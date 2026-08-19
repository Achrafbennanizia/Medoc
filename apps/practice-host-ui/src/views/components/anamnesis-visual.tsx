import { useT } from "@/lib/i18n";
import { useState } from "react";
import { Card, CardHeader } from "./ui/card";
import { type AnamnesisV1, anamnesisLabelFor } from "@/lib/anamnesis";

function EntryList({ entries }: { entries: [string, string][] }) {
    const t = useT();
    const rows = entries.filter(([, version]) => version && String(version).trim());
    if (rows.length === 0) {
        return <p style={{ margin: 0, fontSize: 13, color: "var(--fg-4)", fontStyle: "italic" }}>{t("anamnesis.visual.empty")}</p>;
    }
    return (
        <dl style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0 }}>
            {rows.map(([k, version]) => (
                <div key={k} className="row" style={{ alignItems: "flex-start", gap: 12, justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--fg-3)", fontSize: 12, fontWeight: 600, minWidth: 140 }}>{anamnesisLabelFor(k, t)}</dt>
                    <dd style={{ margin: 0, textAlign: "end", flex: 1, fontSize: 13.5, color: "var(--fg)" }}>{version}</dd>
                </div>
            ))}
        </dl>
    );
}

type AccSection = { id: string; title: string; entries: [string, string][] };

export function AnamnesisVisual({ data }: { data: AnamnesisV1 }) {
    const t = useT();
    const history =
        data.preExisting && typeof data.preExisting === "object" ? Object.entries(data.preExisting) : [];
    const medication = data.medication && typeof data.medication === "object" ? Object.entries(data.medication) : [];
    const allergies = data.allergies && typeof data.allergies === "object" ? Object.entries(data.allergies) : [];

    const insuranceFields: [string, string][] = [
        ["insuranceStatus", data.insuranceStatus ?? ""],
        ["health_insurance", data.health_insurance ?? ""],
    ];

    const sections: AccSection[] = [
        { id: "insurance", title: t("anamnesis.visual.insurance_title"), entries: insuranceFields },
        { id: "history", title: t("anamnesis.visual.history_title"), entries: history },
        { id: "medication", title: t("anamnesis.visual.medication_title"), entries: medication },
        { id: "allergies", title: t("anamnesis.visual.allergies_title"), entries: allergies },
    ];

    const [openId, setOpenId] = useState<string | null>("insurance");

    return (
        <div className="anamnesis-opt-list col" style={{ gap: 0 }}>
            {sections.map((s) => {
                const isOpen = openId === s.id;
                return (
                    <div key={s.id} className={`anamnesis-acc-item ${isOpen ? "is-open" : ""}`}>
                        <button
                            type="button"
                            className="anamnesis-acc-trigger"
                            aria-expanded={isOpen}
                            onClick={() => setOpenId(isOpen ? null : s.id)}
                        >
                            <span>{s.title}</span>
                            <span className="anamnesis-acc-chev" aria-hidden>
                                ▸
                            </span>
                        </button>
                        {isOpen ? (
                            <div className="anamnesis-acc-body">
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
export function AnamnesisVisualFlat({ data }: { data: AnamnesisV1 }) {
    const t = useT();
    const history =
        data.preExisting && typeof data.preExisting === "object" ? Object.entries(data.preExisting) : [];
    const medication = data.medication && typeof data.medication === "object" ? Object.entries(data.medication) : [];
    const allergies = data.allergies && typeof data.allergies === "object" ? Object.entries(data.allergies) : [];
    const insuranceFields: [string, string][] = [
        ["insuranceStatus", data.insuranceStatus ?? ""],
        ["health_insurance", data.health_insurance ?? ""],
    ];
    return (
        <div className="col" style={{ gap: 16 }}>
            <Card className="card-pad">
                <CardHeader title={t("anamnesis.visual.insurance_title")} />
                <EntryList entries={insuranceFields} />
            </Card>
            <Card className="card-pad">
                <CardHeader title={t("anamnesis.visual.history_title")} />
                <EntryList entries={history} />
            </Card>
            <Card className="card-pad">
                <CardHeader title={t("anamnesis.visual.medication_title")} />
                <EntryList entries={medication} />
            </Card>
            <Card className="card-pad">
                <CardHeader title={t("anamnesis.visual.allergies_title")} />
                <EntryList entries={allergies} />
            </Card>
        </div>
    );
}
