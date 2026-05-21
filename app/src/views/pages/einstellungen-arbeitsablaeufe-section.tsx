import { type Dispatch, type SetStateAction } from "react";
import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
    type TermineKalenderAnsicht,
} from "@/lib/client-settings";
import {
    CONFIRMATION_AREA_KEYS,
    CONFIRMATION_AREA_LABELS,
    resolveConfirmationPresentation,
    type AreaOverride,
    type ConfirmationAreaKey,
    type ConfirmationPrefs,
} from "@/lib/confirmation-preferences";
import { errorMessage } from "@/lib/utils";
import { persistAutocompleteSuggestionsToPraxisKv } from "@/lib/praxis-search-prefs-sync";
import type { PraxisPraeferenzen } from "@/lib/praxis-praeferenzen-storage";
import { useUiPreferencesStore } from "@/models/store/ui-preferences-store";
import { Button } from "@/views/components/ui/button";
import { Input, Select } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";

type WorkflowPrefs = NonNullable<ClientSettingsV1["workflows"]>;
type SearchPrefs = NonNullable<ClientSettingsV1["search"]>;

function cycleAreaOverride(cur: AreaOverride | undefined): AreaOverride {
    if (cur == null || cur === "inherit") return "modal";
    if (cur === "modal") return "inline";
    return "inherit";
}

function modeDisplayLabel(prefs: ConfirmationPrefs, key: ConfirmationAreaKey): string {
    const o = prefs.areas[key];
    const resolved = resolveConfirmationPresentation(prefs, key);
    if (o == null || o === "inherit") {
        return resolved === "modal" ? "Standard → Modal" : "Standard → Inline";
    }
    return o === "modal" ? "Modal" : "Inline";
}

export type EinstellungenArbeitsablaeufeSectionProps = {
    praef: PraxisPraeferenzen;
    praefDirty: boolean;
    onPraefChange: Dispatch<SetStateAction<PraxisPraeferenzen>>;
    onPraefDirty: () => void;
    onSavePraef: () => void | Promise<void>;
    workflows: WorkflowPrefs;
    searchPrefs: SearchPrefs;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
};

export function EinstellungenArbeitsablaeufeSection({
    praef,
    praefDirty,
    onPraefChange,
    onPraefDirty,
    onSavePraef,
    workflows: wf,
    searchPrefs,
    onPersistClient,
}: EinstellungenArbeitsablaeufeSectionProps) {
    const toast = useToastStore((s) => s.add);
    const confirmations = useUiPreferencesStore((s) => s.confirmations);
    const hydratedUi = useUiPreferencesStore((s) => s.hydrated);
    const setDefaultConfirmationMode = useUiPreferencesStore((s) => s.setDefaultConfirmationMode);
    const setAreaConfirmationOverride = useUiPreferencesStore((s) => s.setAreaConfirmationOverride);

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">Arbeitsabläufe</div>
                    <div className="card-sub">Termine, Suche, Sicherheitsabfragen</div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 className="text-title" style={{ margin: 0, fontSize: 15 }}>Terminregeln (Praxis-Präferenzen)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                        id="set-puffer"
                        type="number"
                        min={0}
                        label="Puffer zwischen Terminen (Min)"
                        value={praef.pufferMin}
                        onChange={(e) => {
                            onPraefChange((p) => ({ ...p, pufferMin: e.target.value }));
                            onPraefDirty();
                        }}
                    />
                    <Input
                        id="set-notfall"
                        type="number"
                        min={0}
                        label="Notfall-Restzeit (Min)"
                        value={praef.notfallPuffer}
                        onChange={(e) => {
                            onPraefChange((p) => ({ ...p, notfallPuffer: e.target.value }));
                            onPraefDirty();
                        }}
                    />
                    <Select
                        label="Reminder vor Termin"
                        value={praef.reminder}
                        options={[
                            { value: "0", label: "Kein Reminder" },
                            { value: "2", label: "2 Stunden vorher" },
                            { value: "24", label: "24 Stunden vorher" },
                            { value: "48", label: "48 Stunden vorher" },
                        ]}
                        onChange={(e) => {
                            onPraefChange((p) => ({ ...p, reminder: e.target.value }));
                            onPraefDirty();
                        }}
                    />
                    <Select
                        label="No-Show Behandlung"
                        value={praef.noShow}
                        options={[
                            { value: "warn", label: "Nur markieren" },
                            { value: "fee", label: "Ausfallhinweis in Finanzen" },
                            { value: "block", label: "Patient intern kennzeichnen" },
                        ]}
                        onChange={(e) => {
                            onPraefChange((p) => ({ ...p, noShow: e.target.value }));
                            onPraefDirty();
                        }}
                    />
                </div>
                <label className="row" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                    <input
                        type="checkbox"
                        checked={praef.kalenderDragDropEnabled}
                        onChange={(e) => {
                            onPraefChange((p) => ({ ...p, kalenderDragDropEnabled: e.target.checked }));
                            onPraefDirty();
                        }}
                        style={{ marginTop: 3 }}
                    />
                    <span>
                        <span className="text-title" style={{ display: "block", fontSize: 14 }}>
                            Kalender: Drag &amp; Drop (Termine)
                        </span>
                        <span className="card-sub" style={{ display: "block", marginTop: 4 }}>
                            Tages- und Wochenansicht: Termine per Maus verschieben. Aus = nur öffnen und bearbeiten.
                        </span>
                    </span>
                </label>
                <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                    <Button type="button" onClick={() => void onSavePraef()} disabled={!praefDirty}>
                        Speichern
                    </Button>
                </div>

                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
                    <Select
                        label="Standard-Kalenderansicht für „Termine“"
                        value={wf.termineDefaultView ?? "monat"}
                        onChange={(e) =>
                            onPersistClient((c) => {
                                const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                return mergeClientSettingsPatch(c, {
                                    workflows: { ...w, termineDefaultView: e.target.value as TermineKalenderAnsicht },
                                });
                            })
                        }
                        options={[
                            { value: "tag", label: "Tagesansicht" },
                            { value: "woche", label: "Wochenansicht" },
                            { value: "monat", label: "Monatsansicht" },
                        ]}
                    />
                    <p className="card-sub" style={{ margin: "8px 0 0" }}>
                        Wird beim ersten Öffnen von /termine verwendet; die Ansicht in der Terminübersicht aktualisiert diesen
                        Standard.
                    </p>
                </div>

                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
                    <Select
                        label="Standard-Termindauer (Min)"
                        value={String(wf.defaultTerminDauerMin ?? 30)}
                        onChange={(e) =>
                            onPersistClient((c) => {
                                const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                const n = Number.parseInt(e.target.value, 10);
                                return mergeClientSettingsPatch(c, {
                                    workflows: { ...w, defaultTerminDauerMin: Number.isFinite(n) ? n : 30 },
                                });
                            })
                        }
                        options={[
                            { value: "15", label: "15" },
                            { value: "20", label: "20" },
                            { value: "30", label: "30" },
                            { value: "45", label: "45" },
                            { value: "60", label: "60" },
                        ]}
                    />
                    <p className="card-sub" style={{ margin: "8px 0 0" }}>
                        Vorauswahl bei „Neuer Termin“ (lokaler Entwurf kann abweichen).
                    </p>
                </div>

                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
                    <Input
                        id="ta-reminder"
                        label="Tagesabschluss: Erinnerung (HH:MM, lokal)"
                        value={wf.tagesabschlussReminderTime ?? "18:00"}
                        onChange={(e) =>
                            onPersistClient((c) => {
                                const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                return mergeClientSettingsPatch(c, {
                                    workflows: { ...w, tagesabschlussReminderTime: e.target.value },
                                });
                            })
                        }
                        placeholder="18:00"
                    />
                    <p className="card-sub" style={{ margin: "8px 0 0" }}>
                        Hinweis-Toast auf dem Dashboard (einmal pro Tag).
                    </p>
                </div>

                <div className="settings-row" style={{ marginTop: 8 }}>
                    <div>
                        <b>Patientensuche: Versicherungsnummer</b>
                        <div className="card-sub">Suchbegriff auch gegen Versicherungsnummer prüfen</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={searchPrefs.patientIncludeVersicherungsnummer !== false}
                        onChange={() =>
                            onPersistClient((c) => {
                                const s = c.search ?? DEFAULT_CLIENT_SETTINGS.search!;
                                const cur = s.patientIncludeVersicherungsnummer !== false;
                                return mergeClientSettingsPatch(c, {
                                    search: { ...s, patientIncludeVersicherungsnummer: !cur },
                                });
                            })
                        }
                        aria-label="Suche VN"
                    />
                </div>

                <div className="settings-row" style={{ marginTop: 10 }}>
                    <div>
                        <b>Autocomplete-Vorschläge</b>
                        <div className="card-sub">
                            „Meinten Sie …“ bei leerer Patientensuche und im Schnellzugriff (⌘K); nur lokale Schreibhilfe, keine
                            Backend-Suche. Zustand wird in der Praxisdatenbank gespeichert und bei anderen Arbeitsplätzen nach Login
                            übernommen.
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={searchPrefs.autocompleteSuggestionsEnabled !== false}
                        onChange={() =>
                            onPersistClient((c) => {
                                const s = c.search ?? DEFAULT_CLIENT_SETTINGS.search!;
                                const cur = s.autocompleteSuggestionsEnabled !== false;
                                const next = !cur;
                                void persistAutocompleteSuggestionsToPraxisKv(next).catch((e) => {
                                    toast(
                                        `Praxisdatenbank: Autocomplete-Einstellung nicht gespeichert (${errorMessage(e)}). Lokal weiter aktiv.`,
                                        "warning",
                                    );
                                });
                                return mergeClientSettingsPatch(c, {
                                    search: { ...s, autocompleteSuggestionsEnabled: next },
                                });
                            })
                        }
                        aria-label="Autocomplete-Vorschläge"
                    />
                </div>

                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
                    <div className="card-head" style={{ paddingTop: 0 }}>
                        <div>
                            <div className="card-title">Bestätigung bei kritischen Aktionen (Akte)</div>
                            <div className="card-sub">Ein Klick pro Zeile wechselt Standard → Modal → Inline → Standard</div>
                        </div>
                    </div>
                    {!hydratedUi ? (
                        <p className="card-sub" style={{ margin: "0 0 12px" }}>Lade Einstellungen …</p>
                    ) : (
                        <>
                            <div className="settings-row" style={{ marginBottom: 10 }}>
                                <div>
                                    <b>Globaler Standard</b>
                                    <div className="card-sub">wenn „Standard“ in der Tabelle</div>
                                </div>
                                <div className="row" style={{ gap: 8 }}>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={confirmations.defaultMode === "modal" ? "secondary" : "ghost"}
                                        onClick={() =>
                                            void setDefaultConfirmationMode("modal").then(() => toast("Standard: Modal", "info"))
                                        }
                                    >
                                        Modal
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={confirmations.defaultMode === "inline" ? "secondary" : "ghost"}
                                        onClick={() =>
                                            void setDefaultConfirmationMode("inline").then(() => toast("Standard: Inline", "info"))
                                        }
                                    >
                                        Inline
                                    </Button>
                                </div>
                            </div>
                            <div className="tbl-scroll">
                                <table className="tbl" style={{ fontSize: 13 }}>
                                    <thead>
                                        <tr>
                                            <th scope="col">Bereich</th>
                                            <th scope="col">Modus</th>
                                            <th scope="col" style={{ width: 120 }}>
                                                Wechseln
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CONFIRMATION_AREA_KEYS.map((key: ConfirmationAreaKey) => (
                                            <tr key={key}>
                                                <td>{CONFIRMATION_AREA_LABELS[key]}</td>
                                                <td>{modeDisplayLabel(confirmations, key)}</td>
                                                <td>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            void (async () => {
                                                                const next = cycleAreaOverride(confirmations.areas[key]);
                                                                await setAreaConfirmationOverride(key, next);
                                                                toast(
                                                                    `${CONFIRMATION_AREA_LABELS[key]}: ${next === "inherit" ? "Standard" : next === "modal" ? "Modal" : "Inline"}`,
                                                                    "info",
                                                                );
                                                            })()
                                                        }
                                                    >
                                                        Nächster
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
