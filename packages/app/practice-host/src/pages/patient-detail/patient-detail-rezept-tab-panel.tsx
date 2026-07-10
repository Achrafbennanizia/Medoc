import { Fragment } from "react";
import type { usePatientDetailRezeptTab } from "./use-patient-detail-rezept-tab";
import {
    attestGueltigBisFromVonAndTage,
    attestTypSelectOptions,
    illnessSuggestionLabels,
} from "@/lib/attest-composer";
import { MEDIKAMENT_SUGGESTIONS } from "@/lib/medikamente";
import { formatDate } from "@/lib/utils";
import { PlusIcon } from "@/lib/icons";
import { rezeptStatusDisplay } from "@/lib/patient-detail-utils";
import { AkteEditFormOrInline, ConfirmOrInline } from "@/views/components/akte-confirm-presentation";
import { ZahlRowActionsMenu, type ZahlRowAction } from "@/views/components/zahl-row-actions-menu";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { EmptyState } from "@/views/components/ui/empty-state";
import { FormSection } from "@/views/components/ui/form-section";
import { Input, Select, Textarea } from "@/views/components/ui/input";
import { useT, useTParams } from "@/lib/i18n";

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

    const t = useT();
    const tp = useTParams();

    return (
    <div id="panel-rezept" role="tabpanel" aria-labelledby="tab-rezept">
    <Card className="card-pad card--overflow-visible">
        <div className="akte-zahl-modus" role="tablist" aria-label={t("page.patient_detail.rezept.view_aria")} style={{ marginBottom: 16 }}>
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
                {t("page.patient_detail.rezept.tab_rezept")}
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
                {t("nav.atteste")}
            </button>
        </div>
        {rezeptAttestSub === "rezept" ? (
        <>
        <CardHeader
            title={t("page.patient_detail.rezept.title")}
            subtitle={t("page.patient_detail.rezept.subtitle")}
            action={canWriteMedical ? (
                <>
                    <Button type="button" size="sm" variant="secondary" onClick={openRezeptPick} disabled={!id}>
                        {t("page.patient_detail.rezept.predefined_btn")}
                    </Button>
                    <Button type="button" size="sm" onClick={openRezeptNeu} disabled={!id}>
                        <PlusIcon /> {t("page.patient_detail.rezept.new_btn")}
                    </Button>
                </>
            ) : null}
        />
        {!canWriteMedical ? (
            <p className="text-body" style={{ color: "var(--fg-3)", marginBottom: 16 }}>
                {t("page.patient_detail.rezept.readonly_hint")}
            </p>
        ) : null}

            {canWriteMedical && rezeptWizardStep ? (
                <div
                    ref={rezeptWizardPanelRef}
                    id="ak-rezept-wizard-panel"
                    className="rezept-akte-panel"
                    role="region"
                    aria-label={t("page.patient_detail.rezept.wizard_aria")}
                >
                    <div className="rezept-akte-panel-head">
                        <div>
                            <div className="rezept-akte-panel-title">
                                {rezeptWizardStep === "pick" ? t("page.patient_detail.rezept.wizard_pick_title") : null}
                                {rezeptWizardStep === "compose"
                                    ? (rezeptComposerKind === "vorlage" ? t("page.patient_detail.rezept.wizard_from_template") : t("page.patient_detail.rezept.wizard_new"))
                                    : null}
                                {rezeptWizardStep === "ask_vorlage" ? t("page.patient_detail.rezept.wizard_save_template_q") : null}
                                {rezeptWizardStep === "name_vorlage" ? t("page.patient_detail.rezept.wizard_template_name") : null}
                            </div>
                            {rezeptWizardStep === "pick" ? (
                                <div className="rezept-akte-panel-sub">
                                    {t("page.patient_detail.rezept.pick_sub")}
                                </div>
                            ) : null}
                            {rezeptWizardStep === "compose" ? (
                                <div className="rezept-akte-panel-sub">
                                    {t("page.patient_detail.rezept.compose_sub")}
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
                            {t("common.close")}
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
                                    label={t("common.template_search")}
                                    list="ak-rezept-vorlagen-dl"
                                    value={rezeptPickQuery}
                                    onChange={(e) => {
                                        setRezeptPickQuery(e.target.value);
                                        setRezeptPickSelectedId("");
                                    }}
                                    placeholder={t("common.search_title_ph")}
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
                                            {t("page.patient_detail.rezept.no_results")}
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
                                        {t("page.patient_detail.rezept.template_modified").split(t("page.patient_detail.rezept.template_modified_emphasis"))[0]}
                                        <strong>{t("page.patient_detail.rezept.template_modified_emphasis")}</strong>
                                        {t("page.patient_detail.rezept.template_modified").split(t("page.patient_detail.rezept.template_modified_emphasis"))[1]}
                                    </p>
                                ) : null}
                                {rezeptLines.length > 0 ? (
                                    <div style={{ overflowX: "auto", marginBottom: 12 }}>
                                        <table className="tbl">
                                            <thead>
                                                <tr>
                                                    <th>{t("page.rezepte.col.medication")}</th>
                                                    <th>{t("page.rezepte.field.active_ingredient")}</th>
                                                    <th>{t("page.rezepte.col.dosage")}</th>
                                                    <th>{t("page.rezepte.col.duration")}</th>
                                                    <th>{t("page.patient_detail.rezept.col.notes")}</th>
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
                                                                {t("common.remove")}
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
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t("page.patient_detail.rezept.add_line_title")}</div>
                                    {rezeptDraftErr ? (
                                        <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 8px" }}>{rezeptDraftErr}</p>
                                    ) : null}
                                    <Input
                                        id="ak-rz-d-med"
                                        label={t("page.rezepte.field.medication")}
                                        list="ak-rezept-med-dl"
                                        value={rezeptDraft.medikament}
                                        onChange={(e) => pickMedForRezeptDraft(e.target.value)}
                                        placeholder={t("page.rezepte.field.medication_ph")}
                                    />
                                    <Input
                                        id="ak-rz-d-wirk"
                                        label={t("page.rezepte.field.active_ingredient")}
                                        value={rezeptDraft.wirkstoff}
                                        onChange={(e) => setRezeptDraft({ ...rezeptDraft, wirkstoff: e.target.value })}
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input
                                            id="ak-rz-d-dos"
                                            label={t("page.rezepte.field.dosage")}
                                            value={rezeptDraft.dosierung}
                                            onChange={(e) => setRezeptDraft({ ...rezeptDraft, dosierung: e.target.value })}
                                        />
                                        <Input
                                            id="ak-rz-d-dauer"
                                            label={t("page.rezepte.field.duration")}
                                            value={rezeptDraft.dauer}
                                            onChange={(e) => setRezeptDraft({ ...rezeptDraft, dauer: e.target.value })}
                                        />
                                    </div>
                                    <Textarea
                                        id="ak-rz-d-hin"
                                        label={t("page.rezepte.field.notes_line")}
                                        rows={2}
                                        value={rezeptDraft.hinweise}
                                        onChange={(e) => setRezeptDraft({ ...rezeptDraft, hinweise: e.target.value })}
                                    />
                                    <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                                        <Button type="button" size="sm" variant="secondary" onClick={addRezeptDraftLine}>
                                            {t("page.patient_detail.rezept.add_line_btn")}
                                        </Button>
                                    </div>
                                </div>

                                <Textarea
                                    id="ak-rz-shared"
                                    label={t("page.rezepte.shared_notes")}
                                    rows={2}
                                    value={rezeptSharedNotes}
                                    onChange={(e) => setRezeptSharedNotes(e.target.value)}
                                />
                            </>
                        ) : null}

                        {rezeptWizardStep === "ask_vorlage" ? (
                            <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                <strong>{t("common.yes")}:</strong> {t("page.patient_detail.rezept.ask_template_yes")}
                                {" "}
                                <strong>{t("common.no")}:</strong> {t("page.patient_detail.rezept.ask_template_no")}
                            </p>
                        ) : null}

                        {rezeptWizardStep === "name_vorlage" ? (
                            <Input
                                id="ak-rz-vorlage-name"
                                label={t("common.template_label")}
                                value={rezeptNewVorlageTitel}
                                onChange={(e) => setRezeptNewVorlageTitel(e.target.value)}
                                placeholder={t("page.patient_detail.rezept.template_ph")}
                            />
                        ) : null}
                    </div>

                    <div className="rezept-akte-panel-actions">
                        {rezeptWizardStep === "pick" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetRezeptWizard()}>
                                    {t("common.cancel")}
                                </Button>
                                <Button type="button" onClick={proceedRezeptPick}>
                                    {t("common.next")}
                                </Button>
                            </>
                        ) : null}
                        {rezeptWizardStep === "compose" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetRezeptWizard()} disabled={rezeptComposerBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void submitRezeptComposer()}
                                    loading={rezeptComposerBusy}
                                    disabled={rezeptComposerBusy}
                                >
                                    {t("page.patient_detail.rezept.save_for_patient")}
                                </Button>
                            </>
                        ) : null}
                        {rezeptWizardStep === "ask_vorlage" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onRezeptAskVorlageNo}>
                                    {t("common.no")}
                                </Button>
                                <Button type="button" onClick={onRezeptAskVorlageYes}>
                                    {t("common.yes")}
                                </Button>
                            </>
                        ) : null}
                        {rezeptWizardStep === "name_vorlage" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onRezeptNameVorlageSkip} disabled={rezeptComposerBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => onRezeptNameVorlageSave()}
                                    loading={rezeptComposerBusy}
                                    disabled={rezeptComposerBusy}
                                >
                                    {t("page.patient_detail.rezept.save_template_and")}
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}


        <FormSection title={t("page.patient_detail.rezept.list_section")}>
            {rezepte.length === 0 ? (
                <EmptyState
                    icon="💊"
                    title={t("page.patient_detail.rezept.empty_title")}
                    description={canWriteMedical
                        ? t("page.patient_detail.rezept.empty_desc_write")
                        : t("page.patient_detail.rezept.empty_desc_read")}
                    action={canWriteMedical && id
                        ? { label: t("page.patient_detail.rezept.new_btn"), onClick: openRezeptNeu }
                        : undefined}
                />
            ) : (
                <div className="rezept-attest-table-scroll">
                    <table className="tbl tbl-rezept-akte">
                        <thead>
                            <tr>
                                <th>{t("page.rezepte.col.medication")}</th>
                                <th>{t("page.rezepte.col.dosage")}</th>
                                <th>{t("page.rezepte.col.duration")}</th>
                                <th>{t("page.rezepte.col.status")}</th>
                                <th>{t("common.issued")}</th>
                                <th className="rezept-th-actions">{t("patient.detail.tab.behand.col.action")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rezepte.map((r) => {
                                const st = rezeptStatusDisplay(r.status, t);
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
                                                        title={t("page.patient_detail.rezept.edit_title")}
                                                        subtitle={
                                                            rezeptEditUnlocked
                                                                ? t("page.patient_detail.rezept.edit_sub_unlocked")
                                                                : t("page.patient_detail.rezept.edit_sub_locked")
                                                        }
                                                        inlineId={`ak-rezept-edit-inline-${r.id}`}
                                                        ariaLabel={t("page.patient_detail.rezept.edit_title")}
                                                        panelVariant="rezept"
                                                        headerExtra={
                                                            !rezeptEditUnlocked ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={() => setRezeptEditUnlocked(true)}
                                                                >
                                                                    {t("common.edit")}
                                                                </Button>
                                                            ) : null
                                                        }
                                                        footer={(
                                                            <>
                                                                <Button type="button" variant="ghost" onClick={() => setRezeptEdit(null)}>
                                                                    {t("common.cancel")}
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
                                                                    {t("common.save")}
                                                                </Button>
                                                            </>
                                                        )}
                                                    >
                                                        <Input
                                                            id={`rex-med-${r.id}`}
                                                            label={t("page.rezepte.field.medication")}
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
                                                            label={t("page.rezepte.field.active_ingredient")}
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
                                                                label={t("page.rezepte.field.dosage")}
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
                                                                label={t("page.rezepte.field.duration")}
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
                                                            label={t("common.notes")}
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
                                            <td className="rezept-td-actions">
                                                {(() => {
                                                    const actions: ZahlRowAction[] = [
                                                        {
                                                            id: "export",
                                                            label: t("common.export"),
                                                            onClick: () => handlePrintRezept(r),
                                                        },
                                                    ];
                                                    if (canWriteMedical) {
                                                        actions.push(
                                                            {
                                                                id: "edit",
                                                                label: t("common.edit"),
                                                                onClick: () => {
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
                                                                },
                                                            },
                                                            {
                                                                id: "delete",
                                                                label: t("common.delete"),
                                                                onClick: () => {
                                                                    resetRezeptWizard();
                                                                    setRezeptEdit(null);
                                                                    setRezeptDeleteId(r.id);
                                                                },
                                                                danger: true,
                                                            },
                                                        );
                                                    }
                                                    return (
                                                        <ZahlRowActionsMenu
                                                            ariaLabel={t("common.actions")}
                                                            actions={actions}
                                                        />
                                                    );
                                                })()}
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
                    title={t("page.patient_detail.rezept.delete_title")}
                    message={(() => {
                        const r = rezepte.find((x) => x.id === rezeptDeleteId);
                        return r
                            ? tp("page.patient_detail.rezept.delete_confirm", {
                                medication: r.medikament,
                                dosage: r.dosierung,
                                duration: r.dauer,
                            })
                            : t("page.patient_detail.rezept.delete_confirm_generic");
                    })()}
                    onCancel={() => setRezeptDeleteId(null)}
                    onConfirm={() => void handleDeleteRezept()}
                    confirmLabel={t("common.yes_delete")}
                    danger
                />
            ) : null}


        </FormSection>
        </>
        ) : (
        <>
        <CardHeader
            title={t("page.patient_detail.attest.title")}
            subtitle={t("page.patient_detail.attest.subtitle")}
            action={canWriteMedical ? (
                <>
                    <Button type="button" size="sm" variant="secondary" onClick={openAttestPick} disabled={!id}>
                        {t("page.patient_detail.attest.predefined_btn")}
                    </Button>
                    <Button type="button" size="sm" onClick={openAttestNeu} disabled={!id}>
                        <PlusIcon /> {t("page.patient_detail.attest.new_btn")}
                    </Button>
                </>
            ) : null}
        />
        {!canWriteMedical ? (
            <p className="text-body" style={{ color: "var(--fg-3)", marginBottom: 16 }}>
                {t("page.patient_detail.attest.readonly_hint")}
            </p>
        ) : null}

            {canWriteMedical && attestWizardStep ? (
                <div
                    ref={attestWizardPanelRef}
                    id="ak-attest-wizard-panel"
                    className="rezept-akte-panel"
                    role="region"
                    aria-label={t("page.patient_detail.attest.wizard_aria")}
                >
                    <div className="rezept-akte-panel-head">
                        <div>
                            <div className="rezept-akte-panel-title">
                                {attestWizardStep === "pick" ? t("page.patient_detail.attest.wizard_pick_title") : null}
                                {attestWizardStep === "compose"
                                    ? (attestComposerKind === "vorlage" ? t("page.patient_detail.attest.wizard_from_template") : t("page.patient_detail.attest.wizard_new"))
                                    : null}
                                {attestWizardStep === "ask_vorlage" ? t("page.patient_detail.attest.wizard_save_template_q") : null}
                                {attestWizardStep === "name_vorlage" ? t("page.patient_detail.attest.wizard_template_name") : null}
                            </div>
                            {attestWizardStep === "pick" ? (
                                <div className="rezept-akte-panel-sub">
                                    {t("page.patient_detail.attest.pick_sub")}
                                </div>
                            ) : null}
                            {attestWizardStep === "compose" ? (
                                <div className="rezept-akte-panel-sub">
                                    {t("page.patient_detail.attest.compose_sub")}
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
                            {t("common.close")}
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
                                    label={t("common.template_search")}
                                    list="ak-attest-vorlagen-dl"
                                    value={attestPickQuery}
                                    onChange={(e) => {
                                        setAttestPickQuery(e.target.value);
                                        setAttestPickSelectedId("");
                                    }}
                                    placeholder={t("common.search_title_ph")}
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
                                            {t("page.patient_detail.attest.no_results")}
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
                                        {t("page.patient_detail.attest.template_modified").split(t("page.patient_detail.attest.template_modified_emphasis"))[0]}
                                        <strong>{t("page.patient_detail.attest.template_modified_emphasis")}</strong>
                                        {t("page.patient_detail.attest.template_modified").split(t("page.patient_detail.attest.template_modified_emphasis"))[1]}
                                    </p>
                                ) : null}
                                {attestDraftErr ? (
                                    <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 12px" }}>{attestDraftErr}</p>
                                ) : null}
                                <Select
                                    id="ak-att-typ"
                                    label={t("page.patient_detail.attest.field.type")}
                                    value={attestForm.typ}
                                    onChange={(e) => setAttestForm({ ...attestForm, typ: e.target.value })}
                                    options={attestTypSelectOptions(t)}
                                />
                                <div className="row" style={{ gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t("page.patient_detail.attest.certification")}</span>
                                    <label className="row" style={{ gap: 6, fontSize: 13 }}>
                                        <input
                                            type="radio"
                                            name="ak-att-erstfolge"
                                            checked={attestForm.erst_oder_folge === "ERST"}
                                            onChange={() => setAttestForm({ ...attestForm, erst_oder_folge: "ERST" })}
                                        />
                                        {t("page.patient_detail.attest.first_cert")}
                                    </label>
                                    <label className="row" style={{ gap: 6, fontSize: 13 }}>
                                        <input
                                            type="radio"
                                            name="ak-att-erstfolge"
                                            checked={attestForm.erst_oder_folge === "FOLGE"}
                                            onChange={() => setAttestForm({ ...attestForm, erst_oder_folge: "FOLGE" })}
                                        />
                                        {t("page.patient_detail.attest.follow_cert")}
                                    </label>
                                </div>
                                <Input
                                    id="ak-att-icd"
                                    label={t("page.patient_detail.attest.field.icd")}
                                    value={attestForm.icd10_code}
                                    onChange={(e) => setAttestForm({ ...attestForm, icd10_code: e.target.value })}
                                    placeholder={t("page.patient_detail.attest.field.icd_ph")}
                                />
                                {attestForm.typ.includes("Arbeitsunfähig") ? (
                                    <Input
                                        id="ak-att-ag"
                                        label={t("page.patient_detail.attest.employer")}
                                        value={attestForm.arbeitgeber}
                                        onChange={(e) => setAttestForm({ ...attestForm, arbeitgeber: e.target.value })}
                                    />
                                ) : null}
                                <datalist id="ak-attest-krank-dl">
                                    {illnessSuggestionLabels(t).map((label) => (
                                        <option key={label} value={label} />
                                    ))}
                                </datalist>
                                <Input
                                    id="ak-att-krank"
                                    label={t("page.patient_detail.attest.diagnosis")}
                                    list="ak-attest-krank-dl"
                                    value={attestForm.krankheiten}
                                    onChange={(e) => setAttestForm({ ...attestForm, krankheiten: e.target.value })}
                                    placeholder={t("page.patient_detail.attest.diagnosis_ph")}
                                />
                                <Input
                                    id="ak-att-tage"
                                    label={t("page.patient_detail.attest.field.days")}
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
                                        label={`${t("common.valid_from")} *`}
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
                                        label={`${t("common.valid_until")} *`}
                                        value={attestForm.gueltig_bis}
                                        onChange={(e) => setAttestForm({ ...attestForm, gueltig_bis: e.target.value })}
                                    />
                                </div>
                                <Textarea
                                    id="ak-att-ein"
                                    label={t("page.patient_detail.attest.field.restriction")}
                                    rows={4}
                                    value={attestForm.einschraenkung}
                                    onChange={(e) => setAttestForm({ ...attestForm, einschraenkung: e.target.value })}
                                />
                            </>
                        ) : null}

                        {attestWizardStep === "ask_vorlage" ? (
                            <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                <strong>{t("common.yes")}:</strong> {t("page.patient_detail.attest.ask_template_yes")}
                                {" "}
                                <strong>{t("common.no")}:</strong> {t("page.patient_detail.attest.ask_template_no")}
                            </p>
                        ) : null}

                        {attestWizardStep === "name_vorlage" ? (
                            <Input
                                id="ak-att-vorlage-name"
                                label={t("common.template_label")}
                                value={attestNewVorlageTitel}
                                onChange={(e) => setAttestNewVorlageTitel(e.target.value)}
                                placeholder={t("page.patient_detail.attest.template_ph")}
                            />
                        ) : null}
                    </div>

                    <div className="rezept-akte-panel-actions">
                        {attestWizardStep === "pick" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetAttestWizard()}>
                                    {t("common.cancel")}
                                </Button>
                                <Button type="button" onClick={proceedAttestPick}>
                                    {t("common.next")}
                                </Button>
                            </>
                        ) : null}
                        {attestWizardStep === "compose" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => resetAttestWizard()} disabled={attestComposerBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void submitAttestComposer()}
                                    loading={attestComposerBusy}
                                    disabled={attestComposerBusy}
                                >
                                    {t("page.patient_detail.attest.save_for_patient")}
                                </Button>
                            </>
                        ) : null}
                        {attestWizardStep === "ask_vorlage" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onAttestAskVorlageNo}>
                                    {t("common.no")}
                                </Button>
                                <Button type="button" onClick={onAttestAskVorlageYes}>
                                    {t("common.yes")}
                                </Button>
                            </>
                        ) : null}
                        {attestWizardStep === "name_vorlage" ? (
                            <>
                                <Button type="button" variant="ghost" onClick={onAttestNameVorlageSkip} disabled={attestComposerBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => onAttestNameVorlageSave()}
                                    loading={attestComposerBusy}
                                    disabled={attestComposerBusy}
                                >
                                    {t("page.patient_detail.attest.save_template_and")}
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}

        <FormSection title={t("page.patient_detail.attest.list_section")}>
            {atteste.length === 0 ? (
                <EmptyState
                    icon="📄"
                    title={t("page.patient_detail.attest.empty_title")}
                    description={canWriteMedical
                        ? t("page.patient_detail.attest.empty_desc_write")
                        : t("page.patient_detail.attest.empty_desc_read")}
                    action={canWriteMedical && id
                        ? { label: t("page.patient_detail.attest.new_btn"), onClick: openAttestNeu }
                        : undefined}
                />
            ) : (
                <div className="rezept-attest-table-scroll">
                    <table className="tbl tbl-attest-akte">
                        <thead>
                            <tr>
                                <th>{t("page.patient_detail.attest.col.type")}</th>
                                <th>{t("common.valid_from")}</th>
                                <th>{t("common.valid_until")}</th>
                                <th>{t("common.issued")}</th>
                                <th className="attest-th-actions">{t("patient.detail.tab.behand.col.action")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {atteste.map((a) => (
                                <tr key={a.id}>
                                    <td style={{ fontWeight: 600 }}>{a.typ}</td>
                                    <td>{formatDate(a.gueltig_von)}</td>
                                    <td>{formatDate(a.gueltig_bis)}</td>
                                    <td>{formatDate(a.ausgestellt_am)}</td>
                                    <td className="attest-td-actions">
                                        {(() => {
                                            const actions: ZahlRowAction[] = [
                                                {
                                                    id: "export",
                                                    label: t("common.export"),
                                                    onClick: () => handlePrintAttest(a),
                                                },
                                            ];
                                            if (canWriteMedical) {
                                                actions.push({
                                                    id: "delete",
                                                    label: t("common.delete"),
                                                    onClick: () => {
                                                        resetAttestWizard();
                                                        setAttestDeleteId(a.id);
                                                    },
                                                    danger: true,
                                                });
                                            }
                                            return (
                                                <ZahlRowActionsMenu
                                                    ariaLabel={t("common.actions")}
                                                    actions={actions}
                                                />
                                            );
                                        })()}
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
                    title={t("page.patient_detail.attest.delete_title")}
                    message={(() => {
                        const a = atteste.find((x) => x.id === attestDeleteId);
                        return a
                            ? tp("page.patient_detail.attest.delete_confirm", {
                                type: a.typ,
                                from: formatDate(a.gueltig_von),
                                to: formatDate(a.gueltig_bis),
                            })
                            : t("page.patient_detail.attest.delete_confirm_generic");
                    })()}
                    onCancel={() => setAttestDeleteId(null)}
                    onConfirm={() => void handleDeleteAttest()}
                    confirmLabel={t("common.yes_delete")}
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
