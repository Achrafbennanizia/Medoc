import { useT, useTParams } from "@/lib/i18n";
import { Fragment } from "react";
import type { Behandlung } from "@/models/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
    BehandlungAkteComposerPanel,
    type BehandlungAkteComposerPanelProps,
} from "@/views/components/behandlung-akte-composer-panel";
import { ConfirmOrInline } from "@/views/components/akte-confirm-presentation";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card } from "@/views/components/ui/card";

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
                <Card className="card-pad">
                    <div
                        className="row"
                        style={{ justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}
                    >
                        <h3 className="text-title" style={{ margin: 0 }}>
                            {t("patient.detail.tab.behand.title")}
                        </h3>
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
                    </div>
                    {!showBehandComposer ? (
                        <div
                            className="row"
                            style={{ gap: 12, flexWrap: "wrap", marginBottom: behandlungen.length === 0 ? 0 : 16 }}
                            role="group"
                            aria-label={t("patient.detail.tab.behand.start_group_aria")}
                        >
                            <Button
                                type="button"
                                variant="primary"
                                onClick={onStartNewBehandlung}
                                style={{ minWidth: 200 }}
                            >
                                {t("patient.detail.tab.behand.new")}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={behandlungen.length === 0}
                                onClick={onContinueBehandlung}
                                style={{ minWidth: 200 }}
                            >
                                {t("patient.detail.tab.behand.continue")}
                            </Button>
                            <span style={{ alignSelf: "center", fontSize: 12, color: "var(--fg-3)", flexBasis: "100%" }}>
                                {t("patient.detail.tab.behand.continue_hint")}
                            </span>
                        </div>
                    ) : null}
                    {showBehandComposer && !behandEditId ? (
                        <BehandlungAkteComposerPanel {...behandComposerCommon} />
                    ) : null}
                    {behandlungen.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", marginTop: 4 }}>{t("patient.detail.tab.behand.empty")}</p>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
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
                                        <th style={{ width: 220 }}>{t("patient.detail.tab.behand.col.action")}</th>
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
                                                    <td>{b.kategorie || b.art}</td>
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
                                                        {b.freigegeben_von_arzt_id && (b.freigegeben_am ?? "").trim() !== "" ? (
                                                            <Badge variant="primary">{t("patient.detail.tab.behand.billing_released")}</Badge>
                                                        ) : (
                                                            <Badge variant="warning">{t("patient.detail.tab.behand.billing_pending")}</Badge>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                                            {canViewClinical
                                                            && !(b.freigegeben_von_arzt_id && (b.freigegeben_am ?? "").trim() !== "") ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    type="button"
                                                                    onClick={() => void onReleaseForBilling(b.id)}
                                                                >
                                                                    {t("patient.detail.tab.common.release_short")}
                                                                </Button>
                                                            ) : null}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => onOpenEditBehandlung(b)}
                                                            >
                                                                {t("common.edit")}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                onClick={() => onRequestDeleteBehandlung(b.id)}
                                                            >
                                                                {t("common.delete")}
                                                            </Button>
                                                        </div>
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
