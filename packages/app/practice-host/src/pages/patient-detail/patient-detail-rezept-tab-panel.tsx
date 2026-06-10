import { Fragment } from "react";
import type { usePatientDetailRezeptTab } from "./use-patient-detail-rezept-tab";
import {
    ATTEST_TYP_OPTIONS,
    KRANKHEITEN_SUGGESTIONS,
    attestGueltigBisFromVonAndTage,
} from "@/lib/attest-composer";
import { MEDIKAMENT_SUGGESTIONS } from "@/lib/medikamente";
import { formatDate } from "@/lib/utils";
import { PlusIcon } from "@/lib/icons";
import { rezeptStatusDisplay } from "@/lib/patient-detail-utils";
import { AkteEditFormOrInline, ConfirmOrInline } from "@/views/components/akte-confirm-presentation";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { EmptyState } from "@/views/components/ui/empty-state";
import { FormSection } from "@/views/components/ui/form-section";
import { Input, Select, Textarea } from "@/views/components/ui/input";

export type PatientDetailRezeptTabPanelProps = Omit<
    ReturnType<typeof usePatientDetailRezeptTab>,
    "flushAkteSaveConfirm"
>;

export function PatientDetailRezeptTabPanel(props: PatientDetailRezeptTabPanelProps) {
    const {
        id,
        canWriteMedical,
        rezeptAttestSub,
        setRezeptAttestSub,
        resetRezeptWizard,
        resetAttestWizard,
        rezepte,
        atteste,
        rezeptDeleteId,
        setRezeptDeleteId,
        attestDeleteId,
        setAttestDeleteId,
        openRezeptPick,
        openRezeptNeu,
        openAttestPick,
        openAttestNeu,
        proceedRezeptPick,
        proceedAttestPick,
        handleDeleteRezept,
        handleDeleteAttest,
        handlePrintRezept,
        handlePrintAttest,
        runSaveRezeptEdit,
        rezeptEdit,
        setRezeptEdit,
        rezeptEditUnlocked,
        setRezeptEditUnlocked,
        rezeptEditForm,
        setRezeptEditForm,
        rezeptWizardStep,
        rezeptWizardPanelRef,
        rezeptComposerKind,
        rezeptLines,
        rezeptDraft,
        setRezeptDraft,
        rezeptSharedNotes,
        setRezeptSharedNotes,
        rezeptDraftErr,
        rezeptComposerBusy,
        rezeptPickQuery,
        setRezeptPickQuery,
        setRezeptPickSelectedId,
        rezeptNewVorlageTitel,
        setRezeptNewVorlageTitel,
        rezeptVorlagen,
        rezeptPickFiltered,
        rezeptListeGeaendert,
        submitRezeptComposer,
        onRezeptAskVorlageNo,
        onRezeptAskVorlageYes,
        onRezeptNameVorlageSkip,
        onRezeptNameVorlageSave,
        patchRezeptLine,
        pickMedForRezeptDraft,
        addRezeptDraftLine,
        setRezeptLines,
        attestWizardStep,
        attestWizardPanelRef,
        attestComposerKind,
        attestForm,
        setAttestForm,
        attestDraftErr,
        attestComposerBusy,
        attestPickQuery,
        setAttestPickQuery,
        setAttestPickSelectedId,
        attestNewVorlageTitel,
        setAttestNewVorlageTitel,
        attestVorlagen,
        attestPickFiltered,
        attestListeGeaendert,
        submitAttestComposer,
        onAttestAskVorlageNo,
        onAttestAskVorlageYes,
        onAttestNameVorlageSkip,
        onAttestNameVorlageSave,
    } = props;

    return (
    <div id="panel-rezept" role="tabpanel" aria-labelledby="tab-rezept">
    <Card className="card-pad">
        <div className="akte-zahl-modus" role="tablist" aria-label="Ansicht Rezepte oder Atteste" style={{ marginBottom: 16 }}>
            <button
                type="button"
                role="tab"
                aria-selected={rezeptAttestSub === "rezept"}
                className={`akte-zahl-modus__btn${rezeptAttestSub === "rezept" ? " is-active" : ""}`}
                onClick={() => {
                    setRezeptAttestSub("rezept");
                    resetAttestWizard();
                    setAttestDeleteId(null);
                }}
            >
                Rezept
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={rezeptAttestSub === "attest"}
                className={`akte-zahl-modus__btn${rezeptAttestSub === "attest" ? " is-active" : ""}`}
                onClick={() => {
                    setRezeptAttestSub("attest");
                    resetRezeptWizard();
                    setRezeptEdit(null);
                    setRezeptDeleteId(null);
                }}
            >
                Atteste
            </button>
        </div>
        {rezeptAttestSub === "rezept" ? (
        <>
        <CardHeader
            title="Rezepte"
            subtitle="Vordefiniertes oder neues Rezept: die Eingabe öffnet sich oben in der Liste — ohne separates Fenster."
            action={canWriteMedical ? (
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <Button type="button" size="sm" variant="secondary" onClick={openRezeptPick} disabled={!id}>
                        Vordefiniertes Rezept
                    </Button>
                    <Button type="button" size="sm" onClick={openRezeptNeu} disabled={!id}>
                        <PlusIcon /> Neues Rezept
                    </Button>
                </div>
            ) : null}
        />
        {!canWriteMedical ? (
            <p className="text-body" style={{ color: "var(--fg-3)", marginBottom: 16 }}>
                Rezepte können nur von Berechtigten mit ärztlicher Freigabe angelegt oder geändert werden. Die Liste ist einsehbar, sofern Ihre Rolle Zugriff auf die Akte hat.
            </p>
        ) : null}

            {canWriteMedical && rezeptWizardStep ? (
                <div
                    ref={rezeptWizardPanelRef}
                    id="ak-rezept-wizard-panel"
                    className="rezept-akte-panel"
                    role="region"
                    aria-label="Rezept erfassen"
                >
                    <div className="rezept-akte-panel-head">
                        <div>
                            <div className="rezept-akte-panel-title">
                                {rezeptWizardStep === "pick" ? "Vordefiniertes Rezept wählen" : null}
                                {rezeptWizardStep === "compose"
                                    ? (rezeptComposerKind === "vorlage" ? "Rezept aus Vorlage" : "Neues Rezept")
                                    : null}
                                {rezeptWizardStep === "ask_vorlage" ? "Als Praxis-Vorlage speichern?" : null}
                                {rezeptWizardStep === "name_vorlage" ? "Name der neuen Vorlage" : null}
                            </div>
                            {rezeptWizardStep === "pick" ? (
                                <div className="rezept-akte-panel-sub">
                                    Namen eingeben oder aus der Liste wählen. Anschließend können Sie die Zeilen anpassen — die Praxis-Vorlage selbst bleibt unverändert.
                                </div>
                            ) : null}
                            {rezeptWizardStep === "compose" ? (
                                <div className="rezept-akte-panel-sub">
                                    Zeilen ergänzen oder bearbeiten, dann für den Patienten speichern.
                                </div>
                            ) : null}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (!rezeptComposerBusy) resetRezeptWizard();
                            }}
                            disabled={rezeptComposerBusy}
                        >
                            Schließen
                        </Button>
                    </div>

                    <div className="rezept-akte-panel-body">
                        {rezeptWizardStep === "pick" ? (
                            <>
                                <datalist id="ak-rezept-vorlagen-dl">
                                    {rezeptVorlagen.map((v) => (
                                        <option key={v.id} value={v.titel} />
                                    ))}
                                </datalist>
                                <Input
                                    id="ak-rz-pick-q"
                                    label="Vorlage suchen"
                                    list="ak-rezept-vorlagen-dl"
                                    value={rezeptPickQuery}
                                    onChange={(e) => {
                                        setRezeptPickQuery(e.target.value);
                                        setRezeptPickSelectedId("");
                                    }}
                                    placeholder="Titel tippen…"
                                />
                                <div
                                    style={{
                                        maxHeight: 200,
                                        overflowY: "auto",
                                        marginTop: 8,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                    }}
                                >
                                    {rezeptPickFiltered.length === 0 ? (
                                        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                            Keine Treffer — andere Schreibweise oder unter Verwaltung → Vorlagen anlegen.
                                        </span>
                                    ) : (
                                        rezeptPickFiltered.slice(0, 24).map((v) => (
                                            <button
                                                key={v.id}
                                                type="button"
                                                className="btn btn-subtle btn-sm"
                                                style={{ justifyContent: "flex-start", textAlign: "left" }}
                                                onClick={() => {
                                                    setRezeptPickSelectedId(v.id);
                                                    setRezeptPickQuery(v.titel);
                                                }}
                                            >
                                                {v.titel}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : null}

                        {rezeptWizardStep === "compose" ? (
                            <>
                                {rezeptComposerKind === "vorlage" && rezeptListeGeaendert ? (
                                    <p
                                        style={{
                                            fontSize: 12.5,
                                            marginTop: 0,
                                            marginBottom: 12,
                                            padding: "8px 10px",
                                            borderRadius: 8,
                                            background: "var(--accent-soft)",
                                            color: "var(--accent-ink)",
                                        }}
                                    >
                                        Sie haben die Vorlage geändert — es handelt sich um eine <strong>neue Liste</strong> für diesen Patienten. Die hinterlegte Praxis-Vorlage wird nicht überschrieben.
                                    </p>
                                ) : null}
                                {rezeptLines.length > 0 ? (
                                    <div style={{ overflowX: "auto", marginBottom: 12 }}>
                                        <table className="tbl">
                                            <thead>
                                                <tr>
                                                    <th>Medikament</th>
                                                    <th>Wirkstoff</th>
                                                    <th>Dosierung</th>
                                                    <th>Dauer</th>
                                                    <th>Hinweise</th>
                                                    <th />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rezeptLines.map((ln, i) => (
                                                    <tr key={`${i}-${ln.medikament}`}>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.medikament}
                                                                onChange={(e) => patchRezeptLine(i, { medikament: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.wirkstoff}
                                                                onChange={(e) => patchRezeptLine(i, { wirkstoff: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.dosierung}
                                                                onChange={(e) => patchRezeptLine(i, { dosierung: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.dauer}
                                                                onChange={(e) => patchRezeptLine(i, { dauer: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Input
                                                                label=""
                                                                value={ln.hinweise}
                                                                onChange={(e) => patchRezeptLine(i, { hinweise: e.target.value })}
                                                            />
                                                        </td>
                                                        <td>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setRezeptLines((prev) => prev.filter((_, j) => j !== i))}
                                                            >
                                                                Entfernen
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : null}

                                <datalist id="ak-rezept-med-dl">
                                    {MEDIKAMENT_SUGGESTIONS.map((s) => (
                                        <option key={s.label} value={s.label} />
                                    ))}
                                </datalist>
                                <div
                                    style={{
                                        border: "1px solid var(--line)",
                                        borderRadius: 10,
                                        padding: 12,
                                        background: "rgba(0,0,0,0.02)",
                                        marginBottom: 12,
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Weitere Zeile</div>
                                    {rezeptDraftErr ? (
                                        <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 8px" }}>{rezeptDraftErr}</p>
                                    ) : null}
                                    <Input
                                        id="ak-rz-d-med"
                                        label="Medikament *"
                                        list="ak-rezept-med-dl"
                                        value={rezeptDraft.medikament}
                                        onChange={(e) => pickMedForRezeptDraft(e.target.value)}
                                        placeholder="z. B. Ibuprofen 600 mg"
                                    />
                                    <Input
                                        id="ak-rz-d-wirk"
                                        label="Wirkstoff"
                                        value={rezeptDraft.wirkstoff}
                                        onChange={(e) => setRezeptDraft({ ...rezeptDraft, wirkstoff: e.target.value })}
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input
                                            id="ak-rz-d-dos"
                                            label="Dosierung *"
                                            value={rezeptDraft.dosierung}
                                            onChange={(e) => setRezeptDraft({ ...rezeptDraft, dosierung: e.target.value })}
                                        />
                                        <Input
                                            id="ak-rz-d-dauer"
                                            label="Dauer *"
                                            value={rezeptDraft.dauer}
                                            onChange={(e) => setRezeptDraft({ ...rezeptDraft, dauer: e.target.value })}
                                        />
                                    </div>
                                    <Textarea
                                        id="ak-rz-d-hin"
                                        label="Hinweise (Zeile)"
                                        rows={2}
                                        value={rezeptDraft.hinweise}
                                        onChange={(e) => setRezeptDraft({ ...rezeptDraft, hinweise: e.target.value })}
                                    />
                                    <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                                        <Button type="button" size="sm" variant="secondary" onClick={addRezeptDraftLine}>
                                            Zeile übernehmen
                                        </Button>
                                    </div>
                                </div>

                                <Textarea
                                    id="ak-rz-shared"
                                    label="Allgemeine Hinweise (alle Zeilen)"
                                    rows={2}
                                    value={rezeptSharedNotes}
                                    onChange={(e) => setRezeptSharedNotes(e.target.value)}
                                />
                            </>
                        ) : null}

                        {rezeptWizardStep === "ask_vorlage" ? (
                            <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                <strong>Ja:</strong> zusätzlich eine wiederverwendbare Praxis-Vorlage anlegen (Name im nächsten Schritt).
                                {" "}
                                <strong>Nein:</strong> nur die Rezepte für diesen Patienten speichern.
                            </p>
                        ) : null}

                        {rezeptWizardStep === "name_vorlage" ? (
                            <Input
                                id="ak-rz-vorlage-name"
                                label="Bezeichnung der Vorlage"
                                value={rezeptNewVorlageTitel}
                                onChange={(e) => setRezeptNewVorlageTitel(e.target.value)}
                                placeholder="z. B. Post-OP Schmerztherapie"
                            />
                        ) : null}
                    </div>

                    <div className="rezept-akte-panel-actions">
                        {rezeptWizardStep === "pick" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetRezeptWizard()}>
                                    Abbrechen
                                </Button>
                                <Button type="button" onClick={proceedRezeptPick}>
                                    Weiter
                                </Button>
                            </>
                        ) : null}
                        {rezeptWizardStep === "compose" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetRezeptWizard()} disabled={rezeptComposerBusy}>
                                    Abbrechen
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void submitRezeptComposer()}
                                    loading={rezeptComposerBusy}
                                    disabled={rezeptComposerBusy}
                                >
                                    Rezept(e) für Patient speichern
                                </Button>
                            </>
                        ) : null}
                        {rezeptWizardStep === "ask_vorlage" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onRezeptAskVorlageNo}>
                                    Nein
                                </Button>
                                <Button type="button" onClick={onRezeptAskVorlageYes}>
                                    Ja
                                </Button>
                            </>
                        ) : null}
                        {rezeptWizardStep === "name_vorlage" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onRezeptNameVorlageSkip} disabled={rezeptComposerBusy}>
                                    Abbrechen
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => onRezeptNameVorlageSave()}
                                    loading={rezeptComposerBusy}
                                    disabled={rezeptComposerBusy}
                                >
                                    Vorlage anlegen und Rezepte speichern
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}


        <FormSection title="Rezeptliste dieser Akte">
            {rezepte.length === 0 ? (
                <EmptyState
                    icon="💊"
                    title="Keine Rezepte in dieser Akte"
                    description={canWriteMedical
                        ? "Nutzen Sie die Buttons oben — der Assistent erscheint direkt oben in der Liste."
                        : "Für diese Akte wurden noch keine Rezepte erfasst."}
                    action={canWriteMedical && id
                        ? { label: "Neues Rezept", onClick: openRezeptNeu }
                        : undefined}
                />
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Medikament</th>
                                <th>Dosierung</th>
                                <th>Dauer</th>
                                <th>Status</th>
                                <th>Ausgestellt</th>
                                <th style={{ minWidth: 200 }}>Aktion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rezepte.map((r) => {
                                const st = rezeptStatusDisplay(r.status);
                                const showEditRow =
                                    canWriteMedical && rezeptEdit?.id === r.id && !rezeptWizardStep;
                                return (
                                    <Fragment key={r.id}>
                                        {showEditRow ? (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    style={{
                                                        padding: 12,
                                                        verticalAlign: "top",
                                                        background: "var(--bg-elev)",
                                                    }}
                                                >
                                                    <AkteEditFormOrInline
                                                        area="patient_akte_rezept_edit"
                                                        open={canWriteMedical && !!rezeptEdit && !rezeptWizardStep}
                                                        onClose={() => setRezeptEdit(null)}
                                                        title="Rezept bearbeiten"
                                                        subtitle={
                                                            rezeptEditUnlocked
                                                                ? "Änderungen gelten nur für diese Zeile in der Akte."
                                                                : "Ansicht — Felder sind gesperrt. „Bearbeiten“ wählen zum Ändern."
                                                        }
                                                        inlineId={`ak-rezept-edit-inline-${r.id}`}
                                                        ariaLabel="Rezept bearbeiten"
                                                        panelVariant="rezept"
                                                        headerExtra={
                                                            !rezeptEditUnlocked ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={() => setRezeptEditUnlocked(true)}
                                                                >
                                                                    Bearbeiten
                                                                </Button>
                                                            ) : null
                                                        }
                                                        footer={(
                                                            <>
                                                                <Button type="button" variant="ghost" onClick={() => setRezeptEdit(null)}>
                                                                    Abbrechen
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    onClick={() => void runSaveRezeptEdit()}
                                                                    disabled={
                                                                        !rezeptEditUnlocked
                                                                        || !rezeptEditForm.medikament.trim()
                                                                        || !rezeptEditForm.dosierung.trim()
                                                                        || !rezeptEditForm.dauer.trim()
                                                                    }
                                                                >
                                                                    Speichern
                                                                </Button>
                                                            </>
                                                        )}
                                                    >
                                                        <Input
                                                            id={`rex-med-${r.id}`}
                                                            label="Medikament *"
                                                            value={rezeptEditForm.medikament}
                                                            disabled={!rezeptEditUnlocked}
                                                            onChange={(e) =>
                                                                setRezeptEditForm({
                                                                    ...rezeptEditForm,
                                                                    medikament: e.target.value,
                                                                })}
                                                        />
                                                        <Input
                                                            id={`rex-wirk-${r.id}`}
                                                            label="Wirkstoff"
                                                            value={rezeptEditForm.wirkstoff}
                                                            disabled={!rezeptEditUnlocked}
                                                            onChange={(e) =>
                                                                setRezeptEditForm({
                                                                    ...rezeptEditForm,
                                                                    wirkstoff: e.target.value,
                                                                })}
                                                        />
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <Input
                                                                id={`rex-dos-${r.id}`}
                                                                label="Dosierung *"
                                                                value={rezeptEditForm.dosierung}
                                                                disabled={!rezeptEditUnlocked}
                                                                onChange={(e) =>
                                                                    setRezeptEditForm({
                                                                        ...rezeptEditForm,
                                                                        dosierung: e.target.value,
                                                                    })}
                                                            />
                                                            <Input
                                                                id={`rex-dauer-${r.id}`}
                                                                label="Dauer *"
                                                                value={rezeptEditForm.dauer}
                                                                disabled={!rezeptEditUnlocked}
                                                                onChange={(e) =>
                                                                    setRezeptEditForm({
                                                                        ...rezeptEditForm,
                                                                        dauer: e.target.value,
                                                                    })}
                                                            />
                                                        </div>
                                                        <Textarea
                                                            id={`rex-hin-${r.id}`}
                                                            label="Hinweise"
                                                            rows={2}
                                                            value={rezeptEditForm.hinweise}
                                                            disabled={!rezeptEditUnlocked}
                                                            onChange={(e) =>
                                                                setRezeptEditForm({
                                                                    ...rezeptEditForm,
                                                                    hinweise: e.target.value,
                                                                })}
                                                        />
                                                    </AkteEditFormOrInline>
                                                </td>
                                            </tr>
                                        ) : null}
                                        <tr>
                                            <td style={{ fontWeight: 600 }}>{r.medikament}</td>
                                            <td>{r.dosierung}</td>
                                            <td>{r.dauer}</td>
                                            <td><Badge variant={st.variant}>{st.label}</Badge></td>
                                            <td>{formatDate(r.ausgestellt_am)}</td>
                                            <td>
                                                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        type="button"
                                                        onClick={() => handlePrintRezept(r)}
                                                    >
                                                        Exportieren…
                                                    </Button>
                                                    {canWriteMedical ? (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    setRezeptDeleteId(null);
                                                                    resetRezeptWizard();
                                                                    setRezeptEditUnlocked(false);
                                                                    setRezeptEditForm({
                                                                        medikament: r.medikament,
                                                                        wirkstoff: r.wirkstoff ?? "",
                                                                        dosierung: r.dosierung,
                                                                        dauer: r.dauer,
                                                                        hinweise: r.hinweise ?? "",
                                                                    });
                                                                    setRezeptEdit(r);
                                                                }}
                                                            >
                                                                Bearbeiten
                                                            </Button>
                                                            <Button
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={() => {
                                                                    resetRezeptWizard();
                                                                    setRezeptEdit(null);
                                                                    setRezeptDeleteId(r.id);
                                                                }}
                                                            >
                                                                Löschen
                                                            </Button>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {canWriteMedical && rezeptDeleteId ? (
                <ConfirmOrInline
                    area="patient_akte_rezept_delete"
                    open={canWriteMedical && !!rezeptDeleteId}
                    inlineId="ak-rezept-delete-panel"
                    title="Rezept löschen"
                    message={(() => {
                        const r = rezepte.find((x) => x.id === rezeptDeleteId);
                        return r
                            ? `Das Rezept „${r.medikament}“ (${r.dosierung}, ${r.dauer}) wirklich löschen?`
                            : "Dieses Rezept wirklich löschen?";
                    })()}
                    onCancel={() => setRezeptDeleteId(null)}
                    onConfirm={() => void handleDeleteRezept()}
                    confirmLabel="Ja, löschen"
                    danger
                />
            ) : null}


        </FormSection>
        </>
        ) : (
        <>
        <CardHeader
            title="Atteste"
            subtitle="Wie bei den Rezepten: vordefinierte Praxis-Vorlage wählen oder neu erfassen — der Assistent erscheint oben in der Liste."
            action={canWriteMedical ? (
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <Button type="button" size="sm" variant="secondary" onClick={openAttestPick} disabled={!id}>
                        Vordefiniertes Attest
                    </Button>
                    <Button type="button" size="sm" onClick={openAttestNeu} disabled={!id}>
                        <PlusIcon /> Neues Attest
                    </Button>
                </div>
            ) : null}
        />
        {!canWriteMedical ? (
            <p className="text-body" style={{ color: "var(--fg-3)", marginBottom: 16 }}>
                Atteste können nur von Berechtigten mit ärztlicher Freigabe angelegt oder gelöscht werden. Die Liste ist einsehbar, sofern Ihre Rolle Zugriff auf die Akte hat.
            </p>
        ) : null}

            {canWriteMedical && attestWizardStep ? (
                <div
                    ref={attestWizardPanelRef}
                    id="ak-attest-wizard-panel"
                    className="rezept-akte-panel"
                    role="region"
                    aria-label="Attest erfassen"
                >
                    <div className="rezept-akte-panel-head">
                        <div>
                            <div className="rezept-akte-panel-title">
                                {attestWizardStep === "pick" ? "Vordefiniertes Attest wählen" : null}
                                {attestWizardStep === "compose"
                                    ? (attestComposerKind === "vorlage" ? "Attest aus Vorlage" : "Neues Attest")
                                    : null}
                                {attestWizardStep === "ask_vorlage" ? "Als Praxis-Vorlage speichern?" : null}
                                {attestWizardStep === "name_vorlage" ? "Name der neuen Vorlage" : null}
                            </div>
                            {attestWizardStep === "pick" ? (
                                <div className="rezept-akte-panel-sub">
                                    Namen eingeben oder aus der Liste wählen. Anschließend können Sie Text und Zeitraum anpassen — die Praxis-Vorlage selbst bleibt unverändert.
                                </div>
                            ) : null}
                            {attestWizardStep === "compose" ? (
                                <div className="rezept-akte-panel-sub">
                                    Inhalt prüfen, Gültigkeit anpassen, dann für den Patienten speichern.
                                </div>
                            ) : null}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (!attestComposerBusy) resetAttestWizard();
                            }}
                            disabled={attestComposerBusy}
                        >
                            Schließen
                        </Button>
                    </div>

                    <div className="rezept-akte-panel-body">
                        {attestWizardStep === "pick" ? (
                            <>
                                <datalist id="ak-attest-vorlagen-dl">
                                    {attestVorlagen.map((v) => (
                                        <option key={v.id} value={v.titel} />
                                    ))}
                                </datalist>
                                <Input
                                    id="ak-att-pick-q"
                                    label="Vorlage suchen"
                                    list="ak-attest-vorlagen-dl"
                                    value={attestPickQuery}
                                    onChange={(e) => {
                                        setAttestPickQuery(e.target.value);
                                        setAttestPickSelectedId("");
                                    }}
                                    placeholder="Titel tippen…"
                                />
                                <div
                                    style={{
                                        maxHeight: 200,
                                        overflowY: "auto",
                                        marginTop: 8,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                    }}
                                >
                                    {attestPickFiltered.length === 0 ? (
                                        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                            Keine Treffer — unter Verwaltung → Vorlagen (Rezepte und Atteste) anlegen.
                                        </span>
                                    ) : (
                                        attestPickFiltered.slice(0, 24).map((v) => (
                                            <button
                                                key={v.id}
                                                type="button"
                                                className="btn btn-subtle btn-sm"
                                                style={{ justifyContent: "flex-start", textAlign: "left" }}
                                                onClick={() => {
                                                    setAttestPickSelectedId(v.id);
                                                    setAttestPickQuery(v.titel);
                                                }}
                                            >
                                                {v.titel}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : null}

                        {attestWizardStep === "compose" ? (
                            <>
                                {attestComposerKind === "vorlage" && attestListeGeaendert ? (
                                    <p
                                        style={{
                                            fontSize: 12.5,
                                            marginTop: 0,
                                            marginBottom: 12,
                                            padding: "8px 10px",
                                            borderRadius: 8,
                                            background: "var(--accent-soft)",
                                            color: "var(--accent-ink)",
                                        }}
                                    >
                                        Sie haben die Vorlage angepasst — es handelt sich um ein <strong>neues Attest</strong> für diesen Patienten. Die hinterlegte Praxis-Vorlage wird nicht überschrieben.
                                    </p>
                                ) : null}
                                {attestDraftErr ? (
                                    <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 12px" }}>{attestDraftErr}</p>
                                ) : null}
                                <Select
                                    id="ak-att-typ"
                                    label="Attesttyp *"
                                    value={attestForm.typ}
                                    onChange={(e) => setAttestForm({ ...attestForm, typ: e.target.value })}
                                    options={[...ATTEST_TYP_OPTIONS]}
                                />
                                <div className="row" style={{ gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>Bescheinigung:</span>
                                    <label className="row" style={{ gap: 6, fontSize: 13 }}>
                                        <input
                                            type="radio"
                                            name="ak-att-erstfolge"
                                            checked={attestForm.erst_oder_folge === "ERST"}
                                            onChange={() => setAttestForm({ ...attestForm, erst_oder_folge: "ERST" })}
                                        />
                                        Erstbescheinigung
                                    </label>
                                    <label className="row" style={{ gap: 6, fontSize: 13 }}>
                                        <input
                                            type="radio"
                                            name="ak-att-erstfolge"
                                            checked={attestForm.erst_oder_folge === "FOLGE"}
                                            onChange={() => setAttestForm({ ...attestForm, erst_oder_folge: "FOLGE" })}
                                        />
                                        Folgebescheinigung
                                    </label>
                                </div>
                                <Input
                                    id="ak-att-icd"
                                    label="Diagnose (ICD-10)"
                                    value={attestForm.icd10_code}
                                    onChange={(e) => setAttestForm({ ...attestForm, icd10_code: e.target.value })}
                                    placeholder="z. B. K04.0"
                                />
                                {attestForm.typ.includes("Arbeitsunfähig") ? (
                                    <Input
                                        id="ak-att-ag"
                                        label="Arbeitgeber"
                                        value={attestForm.arbeitgeber}
                                        onChange={(e) => setAttestForm({ ...attestForm, arbeitgeber: e.target.value })}
                                    />
                                ) : null}
                                <datalist id="ak-attest-krank-dl">
                                    {KRANKHEITEN_SUGGESTIONS.map((k) => (
                                        <option key={k} value={k} />
                                    ))}
                                </datalist>
                                <Input
                                    id="ak-att-krank"
                                    label="Diagnose / Befund *"
                                    list="ak-attest-krank-dl"
                                    value={attestForm.krankheiten}
                                    onChange={(e) => setAttestForm({ ...attestForm, krankheiten: e.target.value })}
                                    placeholder="Frei eingeben oder aus Vorschlägen wählen"
                                />
                                <Input
                                    id="ak-att-tage"
                                    label="Anzahl der Tage *"
                                    type="number"
                                    min={1}
                                    max={366}
                                    inputMode="numeric"
                                    value={attestForm.tageAnzahl}
                                    onChange={(e) => {
                                        const tage = e.target.value;
                                        setAttestForm((p) => ({
                                            ...p,
                                            tageAnzahl: tage,
                                            gueltig_bis: attestGueltigBisFromVonAndTage(p.gueltig_von, tage),
                                        }));
                                    }}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        id="ak-att-von"
                                        type="date"
                                        label="Gültig von *"
                                        value={attestForm.gueltig_von}
                                        onChange={(e) => {
                                            const von = e.target.value;
                                            setAttestForm((p) => ({
                                                ...p,
                                                gueltig_von: von,
                                                gueltig_bis: attestGueltigBisFromVonAndTage(von, p.tageAnzahl),
                                            }));
                                        }}
                                    />
                                    <Input
                                        id="ak-att-bis"
                                        type="date"
                                        label="Gültig bis *"
                                        value={attestForm.gueltig_bis}
                                        onChange={(e) => setAttestForm({ ...attestForm, gueltig_bis: e.target.value })}
                                    />
                                </div>
                                <Textarea
                                    id="ak-att-ein"
                                    label="Empfohlene Tätigkeitseinschränkung"
                                    rows={4}
                                    value={attestForm.einschraenkung}
                                    onChange={(e) => setAttestForm({ ...attestForm, einschraenkung: e.target.value })}
                                />
                            </>
                        ) : null}

                        {attestWizardStep === "ask_vorlage" ? (
                            <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                <strong>Ja:</strong> zusätzlich eine wiederverwendbare Praxis-Vorlage anlegen (Name im nächsten Schritt).
                                {" "}
                                <strong>Nein:</strong> nur das Attest für diesen Patienten speichern.
                            </p>
                        ) : null}

                        {attestWizardStep === "name_vorlage" ? (
                            <Input
                                id="ak-att-vorlage-name"
                                label="Bezeichnung der Vorlage"
                                value={attestNewVorlageTitel}
                                onChange={(e) => setAttestNewVorlageTitel(e.target.value)}
                                placeholder="z. B. Standard AU nach Extraktion"
                            />
                        ) : null}
                    </div>

                    <div className="rezept-akte-panel-actions">
                        {attestWizardStep === "pick" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetAttestWizard()}>
                                    Abbrechen
                                </Button>
                                <Button type="button" onClick={proceedAttestPick}>
                                    Weiter
                                </Button>
                            </>
                        ) : null}
                        {attestWizardStep === "compose" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetAttestWizard()} disabled={attestComposerBusy}>
                                    Abbrechen
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void submitAttestComposer()}
                                    loading={attestComposerBusy}
                                    disabled={attestComposerBusy}
                                >
                                    Attest für Patient speichern
                                </Button>
                            </>
                        ) : null}
                        {attestWizardStep === "ask_vorlage" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onAttestAskVorlageNo}>
                                    Nein
                                </Button>
                                <Button type="button" onClick={onAttestAskVorlageYes}>
                                    Ja
                                </Button>
                            </>
                        ) : null}
                        {attestWizardStep === "name_vorlage" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onAttestNameVorlageSkip} disabled={attestComposerBusy}>
                                    Abbrechen
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => onAttestNameVorlageSave()}
                                    loading={attestComposerBusy}
                                    disabled={attestComposerBusy}
                                >
                                    Vorlage anlegen und Attest speichern
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}

        <FormSection title="Attestliste dieser Akte">
            {atteste.length === 0 ? (
                <EmptyState
                    icon="📄"
                    title="Keine Atteste in dieser Akte"
                    description={canWriteMedical
                        ? "Nutzen Sie die Buttons oben — der Assistent erscheint direkt oben in der Liste."
                        : "Für diese Akte wurden noch keine Atteste erfasst."}
                    action={canWriteMedical && id
                        ? { label: "Neues Attest", onClick: openAttestNeu }
                        : undefined}
                />
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Typ</th>
                                <th>Gültig von</th>
                                <th>Gültig bis</th>
                                <th>Ausgestellt</th>
                                <th style={{ minWidth: 200 }}>Aktion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {atteste.map((a) => (
                                <tr key={a.id}>
                                    <td style={{ fontWeight: 600 }}>{a.typ}</td>
                                    <td>{formatDate(a.gueltig_von)}</td>
                                    <td>{formatDate(a.gueltig_bis)}</td>
                                    <td>{formatDate(a.ausgestellt_am)}</td>
                                    <td>
                                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                            <Button type="button" size="sm" variant="secondary" onClick={() => handlePrintAttest(a)}>
                                                Exportieren…
                                            </Button>
                                            {canWriteMedical ? (
                                                <Button
                                                    type="button"
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => {
                                                        resetAttestWizard();
                                                        setAttestDeleteId(a.id);
                                                    }}
                                                >
                                                    Löschen
                                                </Button>
                                            ) : (
                                                <span style={{ fontSize: 12, color: "var(--fg-3)" }}>—</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {canWriteMedical && attestDeleteId ? (
                <ConfirmOrInline
                    area="patient_akte_attest_delete"
                    open={canWriteMedical && !!attestDeleteId}
                    inlineId="ak-attest-delete-panel"
                    title="Attest löschen"
                    message={(() => {
                        const a = atteste.find((x) => x.id === attestDeleteId);
                        return a
                            ? `Das Attest „${a.typ}“ (gültig ${formatDate(a.gueltig_von)} – ${formatDate(a.gueltig_bis)}) wirklich löschen?`
                            : "Dieses Attest wirklich löschen?";
                    })()}
                    onCancel={() => setAttestDeleteId(null)}
                    onConfirm={() => void handleDeleteAttest()}
                    confirmLabel="Ja, löschen"
                    danger
                />
            ) : null}


        </FormSection>
        </>
        )}
    </Card>
    </div>
    );
}
