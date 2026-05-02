import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { Patientenakte, Zahnbefund, BehandlungsKatalogItem } from "@/models/types";
import type { PlanNextTerminV2 } from "@/lib/plan-next-termin";
import { planNextHasContent as planNextHasContentFn } from "@/lib/plan-next-termin";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import { DentalChart } from "./DentalChart";

export type BehandAkteFormState = {
    datum: string;
    kategorie: string;
    leistungsname: string;
    leistungKatalogId: string;
    behandlungsnummer: string;
    sitzung: string;
    gesamtkosten: string;
    behandlung_status: string;
    termin_erforderlich: string;
    notizen: string;
};

export type BehandlungAkteComposerPanelProps = {
    navigate: NavigateFunction;
    akte: Patientenakte | null;
    befunde: Zahnbefund[];
    selectedBehandTooth: string | null;
    onSelectTooth: (t: string | null) => void;
    behandEditId: string | null;
    behandComposerMode: "new" | "continue" | null;
    behandFieldsLocked: boolean;
    onUnlockFields: () => void;
    onCancelComposer: () => void;
    continueBehandlungOptions: { value: string; label: string }[];
    continueFromBehandlungId: string;
    applyContinueFromBehandlung: (behandlungId: string) => void;
    behandForm: BehandAkteFormState;
    setBehandForm: Dispatch<SetStateAction<BehandAkteFormState>>;
    kategorieOptions: { value: string; label: string }[];
    leistungOptions: { value: string; label: string }[];
    katalog: BehandlungsKatalogItem[];
    planNext: PlanNextTerminV2;
    runSaveBehandlung: () => void | Promise<void>;
};

export function BehandlungAkteComposerPanel({
    navigate,
    akte,
    befunde,
    selectedBehandTooth,
    onSelectTooth,
    behandEditId,
    behandComposerMode,
    behandFieldsLocked,
    onUnlockFields,
    onCancelComposer,
    continueBehandlungOptions,
    continueFromBehandlungId,
    applyContinueFromBehandlung,
    behandForm,
    setBehandForm,
    kategorieOptions,
    leistungOptions,
    katalog,
    planNext,
    runSaveBehandlung,
}: BehandlungAkteComposerPanelProps) {
    return (
        <div id="ak-behand-composer-panel" className="akte-inline-panel" role="region" aria-label="Behandlung erfassen">
            <div className="akte-inline-panel-head">
                <div>
                    <div className="akte-inline-panel-title">
                        {behandEditId
                            ? "Behandlung bearbeiten"
                            : behandComposerMode === "continue"
                                ? "Behandlung fortsetzen"
                                : "Neue Behandlung"}
                    </div>
                    <div className="akte-inline-panel-sub">
                        Automatisch vergeben:
                        {" "}
                        <strong>{behandForm.behandlungsnummer || "—"}</strong>
                        {" · "}
                        Sitzung <strong>{behandForm.sitzung || "—"}</strong>
                        {" · "}
                        Status <strong>{behandForm.behandlung_status === "GEPLANT" ? "Geplant" : behandForm.behandlung_status === "IN_BEARBEITUNG" ? "In Bearbeitung" : "Durchgeführt"}</strong>
                        {behandFieldsLocked ? " — Ansicht: „Bearbeiten“ zum Entsperren." : null}
                    </div>
                </div>
                <div className="row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {behandFieldsLocked ? (
                        <Button type="button" variant="secondary" size="sm" onClick={onUnlockFields}>
                            Bearbeiten
                        </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" onClick={onCancelComposer}>
                        Abbrechen
                    </Button>
                </div>
            </div>
            <div className="akte-inline-panel-body">
                {behandComposerMode === "continue" && continueBehandlungOptions.length > 0 ? (
                    <div style={{ marginBottom: 14 }}>
                        <Select
                            label="Ausgang: welche Sitzung fortsetzen?"
                            value={continueFromBehandlungId || continueBehandlungOptions[0]?.value || ""}
                            options={continueBehandlungOptions}
                            disabled={behandFieldsLocked}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v) applyContinueFromBehandlung(v);
                            }}
                        />
                        <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>
                            Jede Zeile zeigt B-Nummer, Sitzung, Leistung und Datum. Leistung aus Katalog wird passend zur gewählten Zeile gesetzt.
                        </p>
                    </div>
                ) : null}
                {akte ? (
                    <DentalChart
                        mode="picker"
                        befunde={befunde}
                        selectedTooth={selectedBehandTooth}
                        onToothSelect={onSelectTooth}
                        disabled={behandFieldsLocked}
                    />
                ) : null}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginTop: 16 }}>
                    <Input
                        id="bh-datum"
                        type="date"
                        label="Datum *"
                        value={behandForm.datum}
                        disabled={behandFieldsLocked}
                        onChange={(e) => setBehandForm({ ...behandForm, datum: e.target.value })}
                    />
                    <Input
                        id="bh-zahn"
                        label="Zahnnummer (FDI)"
                        value={selectedBehandTooth ?? ""}
                        disabled={behandFieldsLocked}
                        onChange={(e) => onSelectTooth(e.target.value.trim() || null)}
                        placeholder="aus Chart oder manuell"
                    />
                    <Select
                        label="Kategorie *"
                        value={behandForm.kategorie}
                        options={kategorieOptions}
                        disabled={behandFieldsLocked}
                        onChange={(e) => {
                            const v = e.target.value;
                            setBehandForm({
                                ...behandForm,
                                kategorie: v,
                                leistungsname: "",
                                leistungKatalogId: "",
                                gesamtkosten: "",
                            });
                        }}
                    />
                    <div className="col" style={{ gap: 8 }}>
                        <Select
                            label="Leistung aus Katalog"
                            value={behandForm.leistungKatalogId || ""}
                            options={leistungOptions}
                            disabled={behandFieldsLocked}
                            onChange={(e) => {
                                const idSel = e.target.value;
                                const item = katalog.find((k) => k.id === idSel);
                                setBehandForm({
                                    ...behandForm,
                                    leistungKatalogId: idSel,
                                    leistungsname: item?.name ?? "",
                                    kategorie: item?.kategorie ?? behandForm.kategorie,
                                    gesamtkosten:
                                        item?.default_kosten != null && Number.isFinite(item.default_kosten)
                                            ? String(item.default_kosten)
                                            : behandForm.gesamtkosten,
                                });
                            }}
                        />
                        <Input
                            id="bh-leist-text"
                            label="Leistungsname (Text) *"
                            value={behandForm.leistungsname}
                            disabled={behandFieldsLocked}
                            onChange={(e) =>
                                setBehandForm({
                                    ...behandForm,
                                    leistungsname: e.target.value,
                                    leistungKatalogId: "",
                                })
                            }
                            placeholder="Aus Katalog wählen oder frei eintragen"
                        />
                    </div>
                    <Input
                        id="bh-kosten"
                        label="Gesamtkosten (€)"
                        value={behandForm.gesamtkosten}
                        disabled={behandFieldsLocked}
                        onChange={(e) => setBehandForm({ ...behandForm, gesamtkosten: e.target.value })}
                    />
                </div>

                <details
                    style={{
                        marginTop: 16,
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        background: "rgba(0,0,0,0.015)",
                    }}
                    open={
                        behandForm.termin_erforderlich === "1"
                        || behandForm.notizen.trim().length > 0
                        || planNextHasContentFn(planNext)
                    }
                >
                    <summary style={{ cursor: behandFieldsLocked ? "default" : "pointer", fontWeight: 600, fontSize: 13.5 }}>
                        Nächsten Termin planen (optional)
                    </summary>
                    <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "8px 0 12px" }}>
                        Optional: Status und Folgetermin-Hinweis nur für diese Behandlungszeile. Für die Rezeption nutzen Sie oben „Plan nächsten Termin“.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Status"
                            value={behandForm.behandlung_status}
                            options={[
                                { value: "GEPLANT", label: "Geplant" },
                                { value: "IN_BEARBEITUNG", label: "In Bearbeitung" },
                                { value: "DURCHGEFUEHRT", label: "Durchgeführt" },
                            ]}
                            disabled={behandFieldsLocked}
                            onChange={(e) => setBehandForm({ ...behandForm, behandlung_status: e.target.value })}
                        />
                        <Select
                            label="Termin erforderlich?"
                            value={behandForm.termin_erforderlich}
                            options={[
                                { value: "0", label: "Nein" },
                                { value: "1", label: "Ja — Folgetermin nötig" },
                            ]}
                            disabled={behandFieldsLocked}
                            onChange={(e) => setBehandForm({ ...behandForm, termin_erforderlich: e.target.value })}
                        />
                    </div>
                    <Textarea
                        id="bh-notes"
                        label="Notizen (Behandlung)"
                        value={behandForm.notizen}
                        disabled={behandFieldsLocked}
                        onChange={(e) => setBehandForm({ ...behandForm, notizen: e.target.value })}
                        placeholder="Interne Notiz zu dieser Sitzung"
                        className="min-h-[72px] mt-2"
                    />
                </details>
            </div>

            <div className="akte-inline-panel-actions">
                <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/behandlungs-katalog")}>
                    Katalog verwalten
                </Button>
                <Button type="button" onClick={() => void runSaveBehandlung()} disabled={!akte || behandFieldsLocked}>
                    {behandEditId ? "Änderungen speichern" : "Behandlung speichern"}
                </Button>
            </div>
        </div>
    );
}
