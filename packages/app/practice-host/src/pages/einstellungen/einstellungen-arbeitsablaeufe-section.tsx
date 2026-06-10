import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from "react";
import {
    coverageRatio,
    loadOnboardingProgress,
    resetOnboardingProgress,
    stepsForRole,
} from "@/lib/onboarding";
import { parseRole } from "@/lib/rbac";
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
import { CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED } from "@/lib/settings-ui-flags";
import type { PraxisPraeferenzen } from "@/lib/praxis-praeferenzen-storage";
import { useUiPreferencesStore } from "@/models/store/ui-preferences-store";
import { Button } from "@/views/components/ui/button";
import { Input, Select } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useRbac } from "@/lib/use-rbac";

type WorkflowPrefs = NonNullable<ClientSettingsV1["workflows"]>;
type SearchPrefs = NonNullable<ClientSettingsV1["search"]>;

const AREA_OVERRIDE_OPTIONS: readonly { value: AreaOverride; label: string }[] = [
    { value: "inherit", label: "Standard" },
    { value: "modal", label: "Modal" },
    { value: "inline", label: "Inline" },
];

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
    rolle?: string;
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
    rolle: rolleRaw,
}: EinstellungenArbeitsablaeufeSectionProps) {
    const toast = useToastStore((s) => s.add);
    const { canOpsSystem } = useRbac();
    const rolle = parseRole(rolleRaw);
    const [onboardingPct, setOnboardingPct] = useState<number | null>(null);

    const refreshOnboardingPct = useCallback(async () => {
        if (!rolle) {
            setOnboardingPct(null);
            return;
        }
        try {
            const p = await loadOnboardingProgress(rolle);
            setOnboardingPct(Math.round(coverageRatio(rolle, p.completedRoutes) * 100));
        } catch (e) {
            setOnboardingPct(null);
            toast(`Einführungs-Fortschritt konnte nicht geladen werden: ${errorMessage(e)}`, "warning");
        }
    }, [rolle, toast]);

    useEffect(() => {
        void refreshOnboardingPct();
    }, [refreshOnboardingPct]);
    const confirmations = useUiPreferencesStore((s) => s.confirmations);
    const hydratedUi = useUiPreferencesStore((s) => s.hydrated);
    const hydrateUiPrefs = useUiPreferencesStore((s) => s.hydrate);
    const setDefaultConfirmationMode = useUiPreferencesStore((s) => s.setDefaultConfirmationMode);
    const setAreaConfirmationOverride = useUiPreferencesStore((s) => s.setAreaConfirmationOverride);

    useEffect(() => {
        if (!hydratedUi) void hydrateUiPrefs();
    }, [hydratedUi, hydrateUiPrefs]);

    const persistConfirmationChange = async (action: () => Promise<void>, okMessage: string) => {
        try {
            await action();
            toast(okMessage, "success");
        } catch (e) {
            toast(`Einstellung nicht gespeichert: ${errorMessage(e)}`, "error");
        }
    };

    return (
        <section className="settings-subcard settings-subcard--segment-safe">
            <div className="card-head">
                <div>
                    <div className="card-title">Arbeitsabläufe</div>
                    <div className="card-sub">
                        {canOpsSystem
                            ? "Termine, Suche, Sicherheitsabfragen"
                            : "Termine, Tagesabschluss-Erinnerung, Patientensuche"}
                    </div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {canOpsSystem ? (
                <>
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

                </>
                ) : null}

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

                {canOpsSystem ? (
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
                ) : null}

                {rolle ? (
                    <div className="settings-row" style={{ marginTop: 10 }}>
                        <div>
                            <b>Einführung (NFA-USE-09)</b>
                            <div className="card-sub">
                                Coachmarks pro Route; Fortschritt in der Praxisdatenbank ({stepsForRole(rolle).length}{" "}
                                Schritte für {rolle}).
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                                {onboardingPct == null ? "—" : `${onboardingPct} % abgeschlossen`}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    void resetOnboardingProgress(rolle)
                                        .then(() => refreshOnboardingPct())
                                        .then(() => toast("Einführung zurückgesetzt.", "success"))
                                        .catch((e) =>
                                            toast(
                                                `Zurücksetzen fehlgeschlagen: ${errorMessage(e)}`,
                                                "error",
                                            ),
                                        )
                                }
                            >
                                Einführung zurücksetzen
                            </Button>
                        </div>
                    </div>
                ) : null}

                {CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED ? (
                <div className="settings-row" style={{ marginTop: 10 }}>
                    <div>
                        <b>Termin: Pause / Notfall-Werkzeuge</b>
                        <div className="card-sub">
                            CAL2 — Wenn deaktiviert, bleiben die Toolbar-Schaltflächen ausgeblendet; der Notfall-Filter und ein Hinweis auf
                            der Termin-Seite bleiben verfügbar.
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={wf.calendarEmergencyToolbarEnabled === true}
                        onChange={() =>
                            onPersistClient((c) => {
                                const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                const next = wf.calendarEmergencyToolbarEnabled !== true;
                                return mergeClientSettingsPatch(c, {
                                    workflows: { ...w, calendarEmergencyToolbarEnabled: next },
                                });
                            })
                        }
                        aria-label="Pause und Notfall-Werkzeuge in Terminkalender"
                    />
                </div>
                ) : null}

                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
                    <div className="card-head" style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, borderBottom: "none" }}>
                        <div>
                            <div className="card-title">Bestätigung bei kritischen Aktionen (Akte)</div>
                            <div className="card-sub">
                                Steuert, ob Löschen und Bearbeiten in der Patientenakte als Dialog (Modal) oder als Panel in der Akte
                                (Inline) erscheinen. Gilt praxisweit in der Datenbank.
                            </div>
                        </div>
                    </div>
                    {!hydratedUi ? (
                        <p className="card-sub" style={{ margin: "0 0 12px" }}>Lade Einstellungen …</p>
                    ) : (
                        <>
                            <div className="settings-row" style={{ marginBottom: 10, borderTop: "none", paddingTop: 0 }}>
                                <div>
                                    <b>Globaler Standard</b>
                                    <div className="card-sub">wenn ein Bereich auf „Standard“ steht</div>
                                </div>
                                <div className="seg" role="group" aria-label="Globaler Bestätigungsmodus">
                                    <button
                                        type="button"
                                        aria-pressed={confirmations.defaultMode === "modal"}
                                        onClick={() =>
                                            void persistConfirmationChange(
                                                () => setDefaultConfirmationMode("modal"),
                                                "Standard: Modal",
                                            )
                                        }
                                    >
                                        Modal
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={confirmations.defaultMode === "inline"}
                                        onClick={() =>
                                            void persistConfirmationChange(
                                                () => setDefaultConfirmationMode("inline"),
                                                "Standard: Inline",
                                            )
                                        }
                                    >
                                        Inline
                                    </button>
                                </div>
                            </div>
                            <div className="tbl-scroll settings-confirm-table-wrap">
                                <table className="tbl tbl-settings-confirm" style={{ fontSize: 13 }}>
                                    <thead>
                                        <tr>
                                            <th scope="col">Bereich</th>
                                            <th scope="col">Aktuell</th>
                                            <th scope="col" style={{ width: 180 }}>
                                                Modus
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CONFIRMATION_AREA_KEYS.map((key: ConfirmationAreaKey) => {
                                            const override = confirmations.areas[key] ?? "inherit";
                                            return (
                                                <tr key={key}>
                                                    <td>{CONFIRMATION_AREA_LABELS[key]}</td>
                                                    <td>{modeDisplayLabel(confirmations, key)}</td>
                                                    <td className="settings-confirm-select-cell">
                                                        <Select
                                                            id={`confirm-mode-${key}`}
                                                            className="settings-confirm-select min-w-0"
                                                            aria-label={`Modus: ${CONFIRMATION_AREA_LABELS[key]}`}
                                                            value={override}
                                                            onChange={(e) =>
                                                                void persistConfirmationChange(
                                                                    () =>
                                                                        setAreaConfirmationOverride(
                                                                            key,
                                                                            e.target.value as AreaOverride,
                                                                        ),
                                                                    `${CONFIRMATION_AREA_LABELS[key]}: ${
                                                                        e.target.value === "inherit"
                                                                            ? "Standard"
                                                                            : e.target.value === "modal"
                                                                              ? "Modal"
                                                                              : "Inline"
                                                                    }`,
                                                                )
                                                            }
                                                            options={AREA_OVERRIDE_OPTIONS.map((o) => ({
                                                                value: o.value,
                                                                label:
                                                                    o.value === "inherit"
                                                                        ? `Standard (${confirmations.defaultMode === "modal" ? "Modal" : "Inline"})`
                                                                        : o.label,
                                                            }))}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
