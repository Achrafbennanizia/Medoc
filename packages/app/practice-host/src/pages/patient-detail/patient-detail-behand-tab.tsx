import { behandlungsKatalogCategoryLabel } from "@/lib/behandlungs-katalog-categories";
import { useT, useTParams } from "@/lib/i18n";
import { Fragment } from "react";
import type { Behandlung } from "@/models/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { isReleasedForBilling } from "@/lib/billing-open-booking";
import {
    BehandlungAkteComposerPanel,
    type BehandlungAkteComposerPanelProps,
} from "@/views/components/behandlung-akte-composer-panel";
import { ConfirmOrInline } from "@/views/components/akte-confirm-presentation";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { ZahlRowActionsMenu, type ZahlRowAction } from "@/views/components/zahl-row-actions-menu";

export type PatientDetailBehandTabProps = {
    behandComposerCommon: BehandlungAkteComposerPanelProps;
    behandlungen: Behandlung[];
    behandlungGroups: Behandlung[][];
    showBehandComposer: boolean;
    behandEditId: string | null;
    behandDeleteId: string | null;
    canViewClinical: boolean;
    showClinicalPrices: boolean;
    onToggleClinicalPrices: () => void;
    onStartNewBehandlung: () => void;
    onContinueBehandlung: () => void;
    onReleaseForBilling: (behandlungId: string) => void | Promise<void>;
    onOpenEditBehandlung: (b: Behandlung) => void;
    onRequestDeleteBehandlung: (behandlungId: string) => void;
    onCancelDeleteBehandlung: () => void;
    onConfirmDeleteBehandlung: () => void | Promise<void>;
};

export function PatientDetailBehandTab({
    behandComposerCommon,
    behandlungen,
    behandlungGroups,
    showBehandComposer,
    behandEditId,
    behandDeleteId,
    canViewClinical,
    showClinicalPrices,
    onToggleClinicalPrices,
    onStartNewBehandlung,
    onContinueBehandlung,
    onReleaseForBilling,
    onOpenEditBehandlung,
    onRequestDeleteBehandlung,
    onCancelDeleteBehandlung,
    onConfirmDeleteBehandlung,
}: PatientDetailBehandTabProps) {
    const t = useT();
    const tp = useTParams();
    const emDash = t("common.em_dash");
    const deleteTarget = behandDeleteId
        ? behandlungen.find((x) => x.id === behandDeleteId)
        : undefined;

    return (
        <div id="panel-behand" role="tabpanel" aria-labelledby="tab-behand">
            <div className="col" style={{ gap: 20 }}>
                <Card className="card-pad card--overflow-visible">
                    <CardHeader
                        title={t("patient.detail.tab.behand.title")}
                        subtitle={!showBehandComposer ? t("patient.detail.tab.behand.continue_hint") : undefined}
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
                                {!showBehandComposer ? (
                                    <>
                                        <Button type="button" variant="primary" onClick={onStartNewBehandlung}>
                                            {t("patient.detail.tab.behand.new")}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={behandlungen.length === 0}
                                            onClick={onContinueBehandlung}
                                        >
                                            {t("patient.detail.tab.behand.continue")}
                                        </Button>
                                    </>
                                ) : null}
                            </>
                        )}
                    />
                    {showBehandComposer && !behandEditId ? (
                        <BehandlungAkteComposerPanel {...behandComposerCommon} />
                    ) : null}
                    {behandlungen.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", marginTop: 4 }}>{t("patient.detail.tab.behand.empty")}</p>
                    ) : (
                        <div className="behand-groups-scroll">
                            <table className="tbl tbl-behand-groups">
                                <thead>
                                    <tr>
                                        <th>{t("patient.detail.tab.behand.col.date")}</th>
                                        <th>{t("patient.detail.tab.behand.col.tooth")}</th>
                                        <th>{t("patient.detail.tab.behand.col.category")}</th>
                                        <th>{t("patient.detail.tab.behand.col.service")}</th>
                                        <th>{t("patient.detail.tab.behand.col.session")}</th>
                                        <th>{t("patient.detail.tab.behand.col.number")}</th>
                                        {showClinicalPrices ? <th style={{ textAlign: "right" }}>{t("patient.detail.tab.behand.col.eur")}</th> : null}
                                        <th>{t("patient.detail.tab.behand.col.billing")}</th>
                                        <th className="behand-th-actions">{t("patient.detail.tab.behand.col.action")}</th>
                                    </tr>
                                </thead>
                                {behandlungGroups.map((grp) => (
                                    <tbody key={grp[0]?.id ?? grp.map((x) => x.id).join()} className="behand-grp">
                                        {grp.map((b) => (
                                            <Fragment key={b.id}>
                                                {showBehandComposer && behandEditId === b.id ? (
                                                    <tr>
                                                        <td
                                                            colSpan={showClinicalPrices ? 9 : 8}
                                                            style={{
                                                                padding: 12,
                                                                verticalAlign: "top",
                                                                background: "var(--bg-elev)",
                                                            }}
                                                        >
                                                            <BehandlungAkteComposerPanel {...behandComposerCommon} />
                                                        </td>
                                                    </tr>
                                                ) : null}
                                                <tr>
                                                    <td>
                                                        {b.behandlung_datum
                                                            ? formatDate(b.behandlung_datum)
                                                            : formatDateTime(b.created_at)}
                                                    </td>
                                                    <td>{b.zaehne || emDash}</td>
                                                    <td>
                                                        {b.kategorie
                                                            ? behandlungsKatalogCategoryLabel(t, b.kategorie)
                                                            : b.art}
                                                    </td>
                                                    <td>{b.leistungsname || b.beschreibung || b.art}</td>
                                                    <td>
                                                        {b.sitzung != null
                                                            ? tp("patient.detail.tab.behand.session_nr", { number: b.sitzung })
                                                            : emDash}
                                                    </td>
                                                    <td>{b.behandlungsnummer || emDash}</td>
                                                    {showClinicalPrices ? (
                                                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                                            {b.gesamtkosten != null && Number.isFinite(b.gesamtkosten)
                                                                ? `${b.gesamtkosten.toFixed(2)} €`
                                                                : emDash}
                                                        </td>
                                                    ) : null}
                                                    <td>
                                                        {isReleasedForBilling(b) ? (
                                                            <Badge variant="primary">{t("patient.detail.tab.behand.billing_released")}</Badge>
                                                        ) : (
                                                            <Badge variant="warning">{t("patient.detail.tab.behand.billing_pending")}</Badge>
                                                        )}
                                                    </td>
                                                    <td className="behand-td-actions">
                                                        {(() => {
                                                            const released = isReleasedForBilling(b);
                                                            const actions: ZahlRowAction[] = [];
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
                                                                    onClick: () => onOpenEditBehandlung(b),
                                                                },
                                                                {
                                                                    id: "delete",
                                                                    label: t("common.delete"),
                                                                    onClick: () => onRequestDeleteBehandlung(b.id),
                                                                    danger: true,
                                                                },
                                                            );
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
                                        ))}
                                    </tbody>
                                ))}
                            </table>
                        </div>
                    )}
                </Card>

                {behandDeleteId ? (
                    <ConfirmOrInline
                        area="patient_akte_behandlung_delete"
                        open={!!behandDeleteId}
                        inlineId="ak-behand-delete-panel"
                        title={t("behandlung.delete_title")}
                        message={
                            deleteTarget
                                ? tp("patient.detail.tab.behand.delete_message", {
                                      label:
                                          deleteTarget.leistungsname
                                          || deleteTarget.beschreibung
                                          || deleteTarget.art
                                          || emDash,
                                      session:
                                          deleteTarget.sitzung != null
                                              ? String(deleteTarget.sitzung)
                                              : emDash,
                                  })
                                : t("patient.detail.tab.behand.delete_message_generic")
                        }
                        onCancel={onCancelDeleteBehandlung}
                        onConfirm={() => void onConfirmDeleteBehandlung()}
                        confirmLabel={t("common.yes_delete")}
                        danger
                    />
                ) : null}
            </div>
        </div>
    );
}
