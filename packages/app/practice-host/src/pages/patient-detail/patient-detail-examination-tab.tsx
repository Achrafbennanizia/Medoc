import { treatmentCatalogCategoryLabel } from "@/lib/treatment-catalog-categories";
import { clinicalServiceLabel } from "@/lib/clinical-service-label";
import { useT, useTParams } from "@/lib/i18n";
import type { TreatmentCatalogItem, PatientChart, Examination, DentalFinding } from "@/models/types";
import { parseExaminationV1 } from "@/lib/examination";
import type { ExaminationSubmit } from "@/views/components/examination-composer";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ChartInlineEditPanelShell, ConfirmOrInline } from "@/views/components/chart-confirm-presentation";
import { ExaminationComposer } from "@/views/components/examination-composer";
import { ExaminationDetailPanel } from "@/views/components/examination-detail-panel";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";

export type PatientDetailExaminationTabProps = {
    chart: PatientChart | null;
    findings: DentalFinding[];
    catalog: TreatmentCatalogItem[];
    examinations: Examination[];
    showExaminationComposer: boolean;
    nextExaminationPreview: string;
    examinationDetailId: string | null;
    examinationEdit: Examination | null;
    examinationEditUnlocked: boolean;
    examinationDeleteId: string | null;
    canViewClinical: boolean;
    canWriteMedical: boolean;
    onStartNewExamination: () => void;
    onToggleDetail: (id: string, open: boolean) => void;
    onStartEdit: (u: Examination) => void;
    onRequestDelete: (examinationId: string) => void;
    onUnlockEdit: () => void;
    onCloseEdit: () => void;
    onCancelDelete: () => void;
    onConfirmDelete: () => void | Promise<void>;
    onCloseComposer: () => void;
    onSaveEdit: (payload: ExaminationSubmit) => Promise<void>;
    onCreateExamination: (payload: ExaminationSubmit) => Promise<void>;
};

export function PatientDetailExaminationTab({
    chart,
    findings,
    catalog,
    examinations,
    showExaminationComposer,
    nextExaminationPreview,
    examinationDetailId,
    examinationEdit,
    examinationEditUnlocked,
    examinationDeleteId,
    canViewClinical: _canViewClinical,
    canWriteMedical,
    onStartNewExamination,
    onToggleDetail,
    onStartEdit,
    onRequestDelete,
    onUnlockEdit,
    onCloseEdit,
    onCancelDelete,
    onConfirmDelete,
    onCloseComposer,
    onSaveEdit,
    onCreateExamination,
}: PatientDetailExaminationTabProps) {
    const t = useT();
    const tp = useTParams();
    const emDash = t("common.em_dash");
    const deleteTarget = examinationDeleteId
        ? examinations.find((x) => x.id === examinationDeleteId)
        : undefined;

    return (
        <div id="panel-examination" role="tabpanel" aria-labelledby="tab-examination">
            <div className="col" style={{ gap: "var(--space-4)" }}>
                <Card className="card-pad">
                    <CardHeader
                        title={t("patient.detail.tab.examination.title")}
                        action={canWriteMedical ? (
                            <Button size="sm" disabled={showExaminationComposer} onClick={onStartNewExamination}>
                                {showExaminationComposer
                                    ? t("patient.detail.tab.examination.new_active")
                                    : t("patient.detail.tab.examination.new")}
                            </Button>
                        ) : undefined}
                    />
                    {canWriteMedical && chart && showExaminationComposer ? (
                        <div className="chart-inline-panel" role="region" aria-label={t("patient.detail.tab.examination.new_aria")} style={{ marginBottom: "var(--space-4)" }}>
                            <div className="chart-inline-panel-head">
                                <div>
                                    <div className="chart-inline-panel-title">{t("patient.detail.tab.examination.new")}</div>
                                    <div className="chart-inline-panel-sub">
                                        {tp("patient.detail.tab.examination.new_subtitle", { number: nextExaminationPreview })}
                                    </div>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={onCloseComposer}>
                                    {t("common.close")}
                                </Button>
                            </div>
                            <div className="chart-inline-panel-body" style={{ paddingTop: "var(--space-3)" }}>
                                <ExaminationComposer
                                    findings={findings}
                                    catalog={catalog}
                                    onCancel={onCloseComposer}
                                    onSave={onCreateExamination}
                                />
                            </div>
                        </div>
                    ) : null}
                    {examinations.length === 0 && !showExaminationComposer ? (
                        <p style={{ color: "var(--fg-3)" }}>{t("patient.detail.examination.empty")}</p>
                    ) : (
                        <div className="col examination-stack" style={{ gap: "var(--space-2)" }}>
                            {examinations.flatMap((u) => {
                                const detail = parseExaminationV1(u.results);
                                const open = examinationDetailId === u.id;
                                const entryCard = (
                                    <div key={u.id} className="card" style={{ padding: "var(--space-3)" }}>
                                        <div
                                            className="row"
                                            style={{ justifyContent: "space-between", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}
                                        >
                                            <div className="col" style={{ gap: 2, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                                    {(u.examination_number ?? "").trim()
                                                        ? tp("patient.detail.tab.examination.number_prefix", {
                                                              number: (u.examination_number ?? "").trim(),
                                                          })
                                                        : t("patient.detail.tab.examination.number_unknown")}
                                                    {" · "}
                                                    {formatDateTime(u.created_at)}
                                                </div>
                                                <div style={{ fontWeight: 600 }}>
                                                    {u.diagnosis || detail?.diagnosis || t("patient.detail.tab.common.diagnosis_open")}
                                                </div>
                                                {(u.service_name ?? "").trim() ? (
                                                    <div style={{ fontSize: 13, color: "var(--fg-2)" }}>
                                                        {(u.category ?? "").trim()
                                                            ? `${treatmentCatalogCategoryLabel(t, u.category ?? "")} · `
                                                            : ""}
                                                        {clinicalServiceLabel(u.service_name ?? "")}
                                                        {u.total_cost != null && Number.isFinite(u.total_cost)
                                                            ? ` · ${formatCurrency(u.total_cost)}`
                                                            : ""}
                                                    </div>
                                                ) : null}
                                                {detail?.generalNote?.trim() ? (
                                                    <div style={{ fontSize: 13, color: "var(--fg-2)", whiteSpace: "pre-line" }}>
                                                        {detail.generalNote}
                                                    </div>
                                                ) : null}
                                                <div style={{ color: "var(--fg-3)", fontSize: 13 }}>
                                                    {u.chief_complaint || detail?.chiefComplaint || emDash}
                                                </div>
                                            </div>
                                            <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onToggleDetail(u.id, open)}
                                                >
                                                    {open
                                                        ? t("patient.detail.tab.common.hide_detail")
                                                        : t("patient.detail.tab.common.show_detail")}
                                                </Button>
                                                {canWriteMedical ? (
                                                    <>
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => onStartEdit(u)}>
                                                            {t("common.edit")}
                                                        </Button>
                                                        <Button type="button" variant="danger" size="sm" onClick={() => onRequestDelete(u.id)}>
                                                            {t("common.delete")}
                                                        </Button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                        {open ? (
                                            <div style={{ marginTop: "var(--space-4)" }}>
                                                <ExaminationDetailPanel examination={u} />
                                            </div>
                                        ) : null}
                                    </div>
                                );
                                if (canWriteMedical && examinationEdit?.id === u.id && chart) {
                                    const num = (examinationEdit.examination_number ?? "").trim();
                                    return [
                                        <div key={`${u.id}-edit`} className="examination-stack-edit-slot">
                                            <ChartInlineEditPanelShell
                                                id={`ak-examination-edit-${u.id}`}
                                                ariaLabel={t("patient.detail.tab.examination.edit_aria")}
                                                title={t("patient.detail.tab.examination.edit_title")}
                                                subtitle={tp("patient.detail.tab.examination.edit_subtitle", {
                                                    prefix: num
                                                        ? tp("patient.detail.tab.examination.edit_subtitle_prefix", { number: num })
                                                        : "",
                                                    unlockHint: !examinationEditUnlocked
                                                        ? t("patient.detail.tab.examination.edit_unlock_hint")
                                                        : "",
                                                })}
                                                headerExtra={
                                                    !examinationEditUnlocked ? (
                                                        <Button type="button" variant="secondary" size="sm" onClick={onUnlockEdit}>
                                                            {t("common.edit")}
                                                        </Button>
                                                    ) : null
                                                }
                                                onClose={onCloseEdit}
                                                rootClassName="chart-inline-panel--examination-stack-edit"
                                            >
                                                <ExaminationComposer
                                                    key={examinationEdit.id}
                                                    variant="edit"
                                                    locked={!examinationEditUnlocked}
                                                    initialFromRecord={{
                                                        chiefComplaint: examinationEdit.chief_complaint,
                                                        results: examinationEdit.results,
                                                        diagnosis: examinationEdit.diagnosis,
                                                    }}
                                                    findings={findings}
                                                    onCancel={onCloseEdit}
                                                    onSave={onSaveEdit}
                                                />
                                            </ChartInlineEditPanelShell>
                                        </div>,
                                        entryCard,
                                    ];
                                }
                                return [entryCard];
                            })}
                        </div>
                    )}
                    {canWriteMedical && examinationDeleteId ? (
                        <ConfirmOrInline
                            area="patient_chart_examination_delete"
                            open={!!examinationDeleteId}
                            inlineId="ak-examination-delete-panel"
                            title={t("patient.detail.examination.delete_title")}
                            message={
                                deleteTarget
                                    ? tp("patient.detail.tab.examination.delete_message", {
                                          datetime: formatDateTime(deleteTarget.created_at),
                                          diagnosis: deleteTarget.diagnosis || emDash,
                                      })
                                    : t("patient.detail.tab.examination.delete_message_generic")
                            }
                            onCancel={onCancelDelete}
                            onConfirm={() => void onConfirmDelete()}
                            confirmLabel={t("common.yes_delete")}
                            danger
                        />
                    ) : null}
                </Card>
            </div>
        </div>
    );
}
