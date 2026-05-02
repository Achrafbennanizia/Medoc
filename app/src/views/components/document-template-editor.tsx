import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import { Dialog } from "./ui/dialog";
import {
    EXPORT_TABLE_COLUMN_OPTIONS,
    PRAXIS_FIELD_OPTIONS,
    type DocumentTemplatePayloadV1,
    emptyDocumentTemplatePayloadV1,
} from "@/lib/document-template-schema";

export type DocumentTemplateEditorProps = {
    open: boolean;
    onClose: () => void;
    initial: DocumentTemplatePayloadV1;
    title?: string;
    /** Rückgabe `false`: Dialog bleibt offen (z. B. Validierung). */
    onSave: (payload: DocumentTemplatePayloadV1) => boolean | Promise<boolean>;
    /** Wenn gesetzt: Name der Vorlage (neu / Kopie) im Editor pflegen */
    templateName?: string;
    onTemplateNameChange?: (name: string) => void;
    showNameField?: boolean;
};

export function DocumentTemplateEditor({
    open,
    onClose,
    initial,
    title = "Vorlage bearbeiten",
    onSave,
    templateName = "",
    onTemplateNameChange,
    showNameField = false,
}: DocumentTemplateEditorProps) {
    const [p, setP] = useState<DocumentTemplatePayloadV1>(() => emptyDocumentTemplatePayloadV1());

    useEffect(() => {
        if (open) setP(structuredClone(initial));
    }, [open, initial]);

    const fussTooLong = (p.fusszeile?.length ?? 0) > 240;

    const toggleColumn = (id: typeof EXPORT_TABLE_COLUMN_OPTIONS[number]["id"]) => {
        setP((cur) => ({
            ...cur,
            tableColumns: cur.tableColumns.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
        }));
    };

    const moveColumn = (idx: number, dir: -1 | 1) => {
        setP((cur) => {
            const cols = [...cur.tableColumns];
            const j = idx + dir;
            if (j < 0 || j >= cols.length) return cur;
            [cols[idx], cols[j]] = [cols[j], cols[idx]];
            return { ...cur, tableColumns: cols };
        });
    };

    const togglePraxisField = (id: (typeof PRAXIS_FIELD_OPTIONS)[number]["id"]) => {
        setP((cur) => {
            const set = new Set(cur.kopf.fieldsToShow);
            if (set.has(id)) set.delete(id);
            else set.add(id);
            return { ...cur, kopf: { ...cur.kopf, fieldsToShow: [...set] } };
        });
    };

    const bodyPtClamped = useMemo(() => Math.min(14, Math.max(10, Math.round(p.bodyPt || 11))), [p.bodyPt]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            className="modal--wide"
            footer={(
                <>
                    <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
                    <Button
                        type="button"
                        onClick={() => {
                            void (async () => {
                                const payload = { ...p, bodyPt: bodyPtClamped, fusszeile: p.fusszeile.slice(0, 240) };
                                const ok = await Promise.resolve(onSave(payload));
                                if (ok !== false) onClose();
                            })();
                        }}
                        disabled={fussTooLong || (showNameField && !templateName.trim())}
                    >
                        Übernehmen
                    </Button>
                </>
            )}
        >
            <div className="col" style={{ gap: 14, maxHeight: "min(70vh, 640px)", overflowY: "auto", paddingRight: 4 }}>
                {showNameField ? (
                    <Input
                        label="Name der Vorlage"
                        value={templateName}
                        onChange={(e) => onTemplateNameChange?.(e.target.value)}
                        autoComplete="off"
                    />
                ) : null}
                <fieldset className="card-pad" style={{ border: "1px solid var(--line)", borderRadius: 10, margin: 0 }}>
                    <legend className="text-label">Kopf / Praxis</legend>
                    <label className="row" style={{ gap: 8, marginBottom: 10 }}>
                        <input
                            type="checkbox"
                            checked={p.kopf.showLogo}
                            onChange={(e) => setP((c) => ({ ...c, kopf: { ...c.kopf, showLogo: e.target.checked } }))}
                        />
                        Logo anzeigen (Pfad: Einstellungen → Praxis / app_kv)
                    </label>
                    <Select
                        label="Ausrichtung Kopf"
                        value={p.kopf.alignment}
                        onChange={(e) =>
                            setP((c) => ({
                                ...c,
                                kopf: { ...c.kopf, alignment: e.target.value as DocumentTemplatePayloadV1["kopf"]["alignment"] },
                            }))}
                        options={[
                            { value: "left", label: "Links" },
                            { value: "center", label: "Mittig" },
                            { value: "right", label: "Rechts" },
                        ]}
                    />
                    <div className="text-label" style={{ margin: "10px 0 6px" }}>Praxis-Felder</div>
                    <div className="grid grid-cols-2 gap-2">
                        {PRAXIS_FIELD_OPTIONS.map((f) => (
                            <label key={f.id} className="row" style={{ gap: 8 }}>
                                <input
                                    type="checkbox"
                                    checked={p.kopf.fieldsToShow.includes(f.id)}
                                    onChange={() => togglePraxisField(f.id)}
                                />
                                {f.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <fieldset className="card-pad" style={{ border: "1px solid var(--line)", borderRadius: 10, margin: 0 }}>
                    <legend className="text-label">Empfänger-Block</legend>
                    <label className="row" style={{ gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={p.empfaenger.visible}
                            onChange={(e) => setP((c) => ({ ...c, empfaenger: { ...c.empfaenger, visible: e.target.checked } }))}
                        />
                        Sichtbar
                    </label>
                    <Select
                        label="Ausrichtung"
                        value={p.empfaenger.alignment}
                        onChange={(e) =>
                            setP((c) => ({
                                ...c,
                                empfaenger: {
                                    ...c.empfaenger,
                                    alignment: e.target.value as DocumentTemplatePayloadV1["empfaenger"]["alignment"],
                                },
                            }))}
                        options={[
                            { value: "left", label: "Links" },
                            { value: "center", label: "Mittig" },
                            { value: "right", label: "Rechts" },
                        ]}
                    />
                </fieldset>

                <fieldset className="card-pad" style={{ border: "1px solid var(--line)", borderRadius: 10, margin: 0 }}>
                    <legend className="text-label">Tabellen-Spalten (Reihenfolge)</legend>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                        {p.tableColumns.map((c, idx) => {
                            const lab = EXPORT_TABLE_COLUMN_OPTIONS.find((x) => x.id === c.id)?.label ?? c.id;
                            return (
                                <li key={c.id} className="row" style={{ gap: 8, alignItems: "center" }}>
                                    <input type="checkbox" checked={c.enabled} onChange={() => toggleColumn(c.id)} />
                                    <span style={{ flex: 1 }}>{lab}</span>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => moveColumn(idx, -1)} disabled={idx === 0}>
                                        ↑
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => moveColumn(idx, 1)}
                                        disabled={idx >= p.tableColumns.length - 1}
                                    >
                                        ↓
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                </fieldset>

                <fieldset className="card-pad" style={{ border: "1px solid var(--line)", borderRadius: 10, margin: 0 }}>
                    <legend className="text-label">Signatur</legend>
                    <label className="row" style={{ gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={p.signatur.show}
                            onChange={(e) => setP((c) => ({ ...c, signatur: { ...c.signatur, show: e.target.checked } }))}
                        />
                        Signaturfeld anzeigen
                    </label>
                    <Select
                        label="Beschriftung"
                        value={p.signatur.labelArt}
                        onChange={(e) =>
                            setP((c) => ({
                                ...c,
                                signatur: { ...c.signatur, labelArt: e.target.value as DocumentTemplatePayloadV1["signatur"]["labelArt"] },
                            }))}
                        options={[
                            { value: "arzt", label: "Unterschrift Ärztin/Arzt" },
                            { value: "stempel", label: "Stempel der Praxis" },
                            { value: "both", label: "Beides" },
                        ]}
                    />
                </fieldset>

                <Textarea
                    label={`Fußzeile (max. 240 Zeichen)${fussTooLong ? " — zu lang" : ""}`}
                    value={p.fusszeile}
                    onChange={(e) => setP((c) => ({ ...c, fusszeile: e.target.value }))}
                    rows={3}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Select
                        label="Schriftart"
                        value={p.schriftart}
                        onChange={(e) =>
                            setP((c) => ({ ...c, schriftart: e.target.value as DocumentTemplatePayloadV1["schriftart"] }))}
                        options={[
                            { value: "Helvetica", label: "Helvetica" },
                            { value: "Times", label: "Times" },
                            { value: "Arial", label: "Arial" },
                        ]}
                    />
                    <Input
                        label="Schriftgröße Body (10–14)"
                        type="number"
                        min={10}
                        max={14}
                        value={String(bodyPtClamped)}
                        onChange={(e) => setP((c) => ({ ...c, bodyPt: Number.parseInt(e.target.value, 10) || 11 }))}
                    />
                    <Select
                        label="Dichte"
                        value={p.dichte}
                        onChange={(e) => setP((c) => ({ ...c, dichte: e.target.value as DocumentTemplatePayloadV1["dichte"] }))}
                        options={[
                            { value: "kompakt", label: "Kompakt" },
                            { value: "normal", label: "Normal" },
                            { value: "weit", label: "Weit" },
                        ]}
                    />
                </div>
                <Select
                    label="Datumsformat"
                    value={p.datumsformat}
                    onChange={(e) =>
                        setP((c) => ({ ...c, datumsformat: e.target.value as DocumentTemplatePayloadV1["datumsformat"] }))}
                    options={[
                        { value: "de", label: "de-DE" },
                        { value: "iso", label: "ISO" },
                    ]}
                />
            </div>
        </Dialog>
    );
}
