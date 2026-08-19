import { treatmentCatalogCategoryLabel } from "@/lib/treatment-catalog-categories";
import { useT, useTParams } from "@/lib/i18n";
import { Fragment } from "react";
import type { Treatment } from "@/models/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { isReleasedForBilling } from "@/lib/billing-open-booking";
import {
    TreatmentChartComposerPanel,
    type TreatmentChartComposerPanelProps,
} from "@/views/components/treatment-chart-composer-panel";
import { ConfirmOrInline } from "@/views/components/chart-confirm-presentation";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { PaymentRowActionsMenu, type PaymentRowAction } from "@/views/components/payment-row-actions-menu";

export type PatientDetailTreatmentTabProps = {
    treatmentComposerCommon: TreatmentChartComposerPanelProps;
    treatments: Treatment[];
    treatmentGroups: Treatment[][];
    showTreatmentComposer: boolean;
    treatmentEditId: string | null;
    treatmentDeleteId: string | null;
    canViewClinical: boolean;
    showClinicalPrices: boolean;
    onToggleClinicalPrices: () => void;
    onStartNewTreatment: () => void;
    onContinueTreatment: () => void;
    onReleaseForBilling: (treatmentId: string) => void | Promise<void>;
    onOpenEditTreatment: (b: Treatment) => void;
    onRequestDeleteTreatment: (treatmentId: string) => void;
    onCancelDeleteTreatment: () => void;
    onConfirmDeleteTreatment: () => void | Promise<void>;
};

export function PatientDetailTreatmentTab({
    treatmentComposerCommon,
    treatments,
    treatmentGroups,
    showTreatmentComposer,
    treatmentEditId,
    treatmentDeleteId,
    canViewClinical,
    showClinicalPrices,
    onToggleClinicalPrices,
    onStartNewTreatment,
    onContinueTreatment,
    onReleaseForBilling,
    onOpenEditTreatment,
    onRequestDeleteTreatment,
    onCancelDeleteTreatment,
    onConfirmDeleteTreatment,
}: PatientDetailTreatmentTabProps) {
    const t = useT();
    const tp = useTParams();
    const emDash = t("common.em_dash");
    const deleteTarget = treatmentDeleteId
        ? treatments.find((x) => x.id === treatmentDeleteId)
        : undefined;

    return (
        <div id="panel-treatment" role="tabpanel" aria-labelledby="tab-treatment">
            <div className="col" style={{ gap: 20 }}>
                <Card className="card-pad card--overflow-visible">
                    <CardHeader
                        title={t("patient.detail.tab.treatment.title")}
                        subtitle={!showTreatmentComposer ? t("patient.detail.tab.treatment.continue_hint") : undefined}
                        action={(
                            <>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={showClinicalPrices ? "primary" : "ghost"}
                                    onClick={onToggleClinicalPrices}
                                    aria-pressed={showClinicalPrices}
                                >
                                    {showClinicalPrices
                                        ? t("patient.detail.tab.common.hide_prices")
                                        : t("patient.detail.tab.common.show_prices")}
                                </Button>
                                {!showTreatmentComposer ? (
                                    <>
                                        <Button type="button" variant="primary" onClick={onStartNewTreatment}>
                                            {t("patient.detail.tab.treatment.new")}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={treatments.length === 0}
                                            onClick={onContinueTreatment}
                                        >
                                            {t("patient.detail.tab.treatment.continue")}
                                        </Button>
                                    </>
                                ) : null}
                            </>
                        )}
                    />
                    {showTreatmentComposer && !treatmentEditId ? (
                        <TreatmentChartComposerPanel {...treatmentComposerCommon} />
                    ) : null}
                    {treatments.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", marginTop: 4 }}>{t("patient.detail.tab.treatment.empty")}</p>
                    ) : (
                        <div className="treatment-groups-scroll">
                            <table className="tbl tbl-treatment-groups">
                                <thead>
                                    <tr>
                                        <th>{t("patient.detail.tab.treatment.col.date")}</th>
                                        <th>{t("patient.detail.tab.treatment.col.tooth")}</th>
                                        <th>{t("patient.detail.tab.treatment.col.category")}</th>
                                        <th>{t("patient.detail.tab.treatment.col.service")}</th>
                                        <th>{t("patient.detail.tab.treatment.col.session")}</th>
                                        <th>{t("patient.detail.tab.treatment.col.number")}</th>
                                        {showClinicalPrices ? <th style={{ textAlign: "right" }}>{t("patient.detail.tab.treatment.col.eur")}</th> : null}
                                        <th>{t("patient.detail.tab.treatment.col.billing")}</th>
                                        <th className="treatment-th-actions">{t("patient.detail.tab.treatment.col.action")}</th>
                                    </tr>
                                </thead>
                                {treatmentGroups.map((grp) => (
                                    <tbody key={grp[0]?.id ?? grp.map((x) => x.id).join()} className="treatment-grp">
                                        {grp.map((b) => (
                                            <Fragment key={b.id}>
                                                {showTreatmentComposer && treatmentEditId === b.id ? (
                                                    <tr>
                                                        <td
                                                            colSpan={showClinicalPrices ? 9 : 8}
                                                            style={{
                                                                padding: 12,
                                                                verticalAlign: "top",
                                                                background: "var(--bg-elev)",
                                                            }}
                                                        >
                                                            <TreatmentChartComposerPanel {...treatmentComposerCommon} />
                                                        </td>
                                                    </tr>
                                                ) : null}
                                                <tr>
                                                    <td>
                                                        {b.treatment_date
                                                            ? formatDate(b.treatment_date)
                                                            : formatDateTime(b.created_at)}
                                                    </td>
                                                    <td>{b.teeth || emDash}</td>
                                                    <td>
                                                        {b.category
                                                            ? treatmentCatalogCategoryLabel(t, b.category)
                                                            : b.kind}
                                                    </td>
                                                    <td>{b.service_name || b.description || b.kind}</td>
                                                    <td>
                                                        {b.session_number != null
                                                            ? tp("patient.detail.tab.treatment.session_nr", { number: b.session_number })
                                                            : emDash}
                                                    </td>
                                                    <td>{b.treatment_number || emDash}</td>
                                                    {showClinicalPrices ? (
                                                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                                            {b.total_cost != null && Number.isFinite(b.total_cost)
                                                                ? `${b.total_cost.toFixed(2)} €`
                                                                : emDash}
                                                        </td>
                                                    ) : null}
                                                    <td>
                                                        {isReleasedForBilling(b) ? (
                                                            <Badge variant="primary">{t("patient.detail.tab.treatment.billing_released")}</Badge>
                                                        ) : (
                                                            <Badge variant="warning">{t("patient.detail.tab.treatment.billing_pending")}</Badge>
                                                        )}
                                                    </td>
                                                    <td className="treatment-td-actions">
                                                        {(() => {
                                                            const released = isReleasedForBilling(b);
                                                            const actions: PaymentRowAction[] = [];
                                                            if (canViewClinical && !released) {
                                                                actions.push({
                                                                    id: "release",
                                                                    label: t("patient.detail.tab.common.release_short"),
                                                                    onClick: () => void onReleaseForBilling(b.id),
                                                                });
                                                            }
                                                            actions.push(
                                                                {
                                                                    id: "edit",
                                                                    label: t("common.edit"),
                                                                    onClick: () => onOpenEditTreatment(b),
                                                                },
                                                                {
                                                                    id: "delete",
                                                                    label: t("common.delete"),
                                                                    onClick: () => onRequestDeleteTreatment(b.id),
                                                                    danger: true,
                                                                },
                                                            );
                                                            return (
                                                                <PaymentRowActionsMenu
                                                                    ariaLabel={t("common.actions")}
                                                                    actions={actions}
                                                                />
                                                            );
                                                        })()}
                                                    </td>
                                                </tr>
                                            </Fragment>
                                        ))}
                                    </tbody>
                                ))}
                            </table>
                        </div>
                    )}
                </Card>

                {treatmentDeleteId ? (
                    <ConfirmOrInline
                        area="patient_chart_treatment_delete"
                        open={!!treatmentDeleteId}
                        inlineId="ak-treatment-delete-panel"
                        title={t("treatment.delete_title")}
                        message={
                            deleteTarget
                                ? tp("patient.detail.tab.treatment.delete_message", {
                                      label:
                                          deleteTarget.service_name
                                          || deleteTarget.description
                                          || deleteTarget.kind
                                          || emDash,
                                      session:
                                          deleteTarget.session_number != null
                                              ? String(deleteTarget.session_number)
                                              : emDash,
                                  })
                                : t("patient.detail.tab.treatment.delete_message_generic")
                        }
                        onCancel={onCancelDeleteTreatment}
                        onConfirm={() => void onConfirmDeleteTreatment()}
                        confirmLabel={t("common.yes_delete")}
                        danger
                    />
                ) : null}
            </div>
        </div>
    );
}
