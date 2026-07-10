import { useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import type { BehandlungsKatalogItem, Patientenakte, Untersuchung, Zahnbefund } from "@/models/types";
import { clinicalSummaryFromUntersuchung } from "@/lib/untersuchung";
import { isReleasedForBilling, untersuchungHasBillableLeistung } from "@/lib/billing-open-booking";
import type { UntersuchungSubmit } from "@/views/components/UntersuchungComposer";
import { formatDateTime } from "@/lib/utils";
import { AkteInlineEditPanelShell, ConfirmOrInline } from "@/views/components/akte-confirm-presentation";
import { UntersuchungComposer } from "@/views/components/UntersuchungComposer";
import { UntersuchungDetailPanel } from "@/views/components/UntersuchungDetailPanel";
import {
    EMPTY_UNTERSUCHUNG_BILLING,
    UntersuchungBillingFields,
} from "@/views/components/untersuchung-billing-fields";
import { Button } from "@/views/components/ui/button";
import { Badge } from "@/views/components/ui/badge";
import { Card, CardHeader } from "@/views/components/ui/card";

export type PatientDetailUnterTabProps = {
    akte: Patientenakte | null;
    befunde: Zahnbefund[];
    katalog: BehandlungsKatalogItem[];
    untersuchungen: Untersuchung[];
    showUnterComposer: boolean;
    nextUnterPreview: string;
    unterDetailId: string | null;
    unterEdit: Untersuchung | null;
    unterEditUnlocked: boolean;
    unterDeleteId: string | null;
    canViewClinical: boolean;
    onStartNewUntersuchung: () => void;
    onToggleDetail: (id: string, open: boolean) => void;
    onStartEdit: (u: Untersuchung) => void;
    onRequestDelete: (untersuchungId: string) => void;
    onUnlockEdit: () => void;
    onCloseEdit: () => void;
    onCancelDelete: () => void;
    onConfirmDelete: () => void | Promise<void>;
    onCloseComposer: () => void;
    onApplyTooth: (tooth: number, statusKey: string) => Promise<void>;
    onSaveEdit: (payload: UntersuchungSubmit) => Promise<void>;
    onCreateUntersuchung: (payload: UntersuchungSubmit) => Promise<void>;
    onReleaseForBilling: (untersuchungId: string) => void | Promise<void>;
};

export function PatientDetailUnterTab({
    akte,
    befunde,
    katalog,
    untersuchungen,
    showUnterComposer,
    nextUnterPreview,
    unterDetailId,
    unterEdit,
    unterEditUnlocked,
    unterDeleteId,
    canViewClinical,
    onStartNewUntersuchung,
    onToggleDetail,
    onStartEdit,
    onRequestDelete,
    onUnlockEdit,
    onCloseEdit,
    onCancelDelete,
    onConfirmDelete,
    onCloseComposer,
    onApplyTooth,
    onSaveEdit,
    onCreateUntersuchung,
    onReleaseForBilling,
}: PatientDetailUnterTabProps) {
    const t = useT();
    const tp = useTParams();
    const emDash = t("common.em_dash");
    const [billingForm, setBillingForm] = useState(EMPTY_UNTERSUCHUNG_BILLING);

    const wrapCreateWithBilling = async (payload: UntersuchungSubmit) => {
        const gRaw = billingForm.gesamtkosten.trim().replace(",", ".");
        const g = gRaw ? Number.parseFloat(gRaw) : NaN;
        await onCreateUntersuchung({
            ...payload,
            kategorie: billingForm.kategorie.trim() || null,
            leistungsname: billingForm.leistungsname.trim() || null,
            gesamtkosten: Number.isFinite(g) ? g : null,
        });
        setBillingForm(EMPTY_UNTERSUCHUNG_BILLING());
    };
    const deleteTarget = unterDeleteId
        ? untersuchungen.find((x) => x.id === unterDeleteId)
        : undefined;

    return (
        <div id="panel-unter" role="tabpanel" aria-labelledby="tab-unter">
            <div className="col" style={{ gap: 16 }}>
                <Card className="card-pad">
                    <CardHeader
                        title={t("patient.detail.tab.unter.title")}
                        action={(
                            <Button size="sm" disabled={showUnterComposer} onClick={onStartNewUntersuchung}>
                                {showUnterComposer
                                    ? t("patient.detail.tab.unter.new_active")
                                    : t("patient.detail.tab.unter.new")}
                            </Button>
                        )}
                    />
                    {akte && showUnterComposer ? (
                        <div className="akte-inline-panel" role="region" aria-label={t("patient.detail.tab.unter.new_aria")} style={{ marginBottom: 16 }}>
                            <div className="akte-inline-panel-head">
                                <div>
                                    <div className="akte-inline-panel-title">{t("patient.detail.tab.unter.new")}</div>
                                    <div className="akte-inline-panel-sub">
                                        {tp("patient.detail.tab.unter.new_subtitle", { number: nextUnterPreview })}
                                    </div>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={onCloseComposer}>
                                    {t("common.close")}
                                </Button>
                            </div>
                            <div className="akte-inline-panel-body" style={{ paddingTop: 12 }}>
                                <UntersuchungBillingFields
                                    katalog={katalog}
                                    form={billingForm}
                                    setForm={setBillingForm}
                                />
                                <UntersuchungComposer
                                    befunde={befunde}
                                    onApplyTooth={onApplyTooth}
                                    onCancel={onCloseComposer}
                                    onSave={wrapCreateWithBilling}
                                />
                            </div>
                        </div>
                    ) : null}
                    {untersuchungen.length === 0 && !showUnterComposer ? (
                        <p style={{ color: "var(--fg-3)" }}>{t("patient.detail.unter.empty")}</p>
                    ) : (
                        <div className="col unter-stack" style={{ gap: 8 }}>
                            {untersuchungen.flatMap((u) => {
                                const summary = clinicalSummaryFromUntersuchung(u);
                                const open = unterDetailId === u.id;
                                const billable = untersuchungHasBillableLeistung(u.leistungsname, u.gesamtkosten);
                                const released = isReleasedForBilling(u);
                                const entryCard = (
                                    <div key={u.id} className="card" style={{ padding: 12 }}>
                                        <div
                                            className="row"
                                            style={{ justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}
                                        >
                                            <div className="col" style={{ gap: 2, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                                    {(u.untersuchungsnummer ?? "").trim()
                                                        ? tp("patient.detail.tab.unter.number_prefix", {
                                                              number: (u.untersuchungsnummer ?? "").trim(),
                                                          })
                                                        : t("patient.detail.tab.unter.number_unknown")}
                                                    {" · "}
                                                    {formatDateTime(u.created_at)}
                                                </div>
                                                <div style={{ fontWeight: 600 }}>
                                                    {summary.diagnosis || t("patient.detail.tab.common.diagnosis_open")}
                                                </div>
                                                {summary.plan ? (
                                                    <div style={{ fontSize: 13, color: "var(--fg-2)", whiteSpace: "pre-line" }}>
                                                        <span style={{ fontWeight: 600, color: "var(--fg-3)" }}>
                                                            {t("untersuchung.composer.plan")}:{" "}
                                                        </span>
                                                        {summary.plan}
                                                    </div>
                                                ) : null}
                                                {!open && summary.generalNote ? (
                                                    <div style={{ fontSize: 13, color: "var(--fg-2)", whiteSpace: "pre-line" }}>
                                                        {summary.generalNote}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                                {billable ? (
                                                    released ? (
                                                        <Badge variant="primary">{t("patient.detail.tab.common.billing_released")}</Badge>
                                                    ) : (
                                                        <Badge variant="warning">{t("patient.detail.tab.common.billing_pending")}</Badge>
                                                    )
                                                ) : null}
                                                {canViewClinical && billable && !released ? (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => void onReleaseForBilling(u.id)}
                                                    >
                                                        {t("patient.detail.tab.common.release_short")}
                                                    </Button>
                                                ) : null}
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
                                                <Button type="button" variant="ghost" size="sm" onClick={() => onStartEdit(u)}>
                                                    {t("common.edit")}
                                                </Button>
                                                <Button type="button" variant="danger" size="sm" onClick={() => onRequestDelete(u.id)}>
                                                    {t("common.delete")}
                                                </Button>
                                            </div>
                                        </div>
                                        {open ? (
                                            <div style={{ marginTop: 14 }}>
                                                <UntersuchungDetailPanel untersuchung={u} />
                                            </div>
                                        ) : null}
                                    </div>
                                );
                                if (unterEdit?.id === u.id && akte) {
                                    const num = (unterEdit.untersuchungsnummer ?? "").trim();
                                    return [
                                        <div key={`${u.id}-edit`} className="unter-stack-edit-slot">
                                            <AkteInlineEditPanelShell
                                                id={`ak-unter-edit-${u.id}`}
                                                ariaLabel={t("patient.detail.tab.unter.edit_aria")}
                                                title={t("patient.detail.tab.unter.edit_title")}
                                                subtitle={tp("patient.detail.tab.unter.edit_subtitle", {
                                                    prefix: num
                                                        ? tp("patient.detail.tab.unter.edit_subtitle_prefix", { number: num })
                                                        : "",
                                                    unlockHint: !unterEditUnlocked
                                                        ? t("patient.detail.tab.unter.edit_unlock_hint")
                                                        : "",
                                                })}
                                                headerExtra={
                                                    !unterEditUnlocked ? (
                                                        <Button type="button" variant="secondary" size="sm" onClick={onUnlockEdit}>
                                                            {t("common.edit")}
                                                        </Button>
                                                    ) : null
                                                }
                                                onClose={onCloseEdit}
                                                rootClassName="akte-inline-panel--unter-stack-edit"
                                            >
                                                <UntersuchungComposer
                                                    key={unterEdit.id}
                                                    variant="edit"
                                                    locked={!unterEditUnlocked}
                                                    initialFromRecord={{
                                                        beschwerden: unterEdit.beschwerden,
                                                        ergebnisse: unterEdit.ergebnisse,
                                                        diagnose: unterEdit.diagnose,
                                                    }}
                                                    befunde={befunde}
                                                    onApplyTooth={onApplyTooth}
                                                    onCancel={onCloseEdit}
                                                    onSave={onSaveEdit}
                                                />
                                            </AkteInlineEditPanelShell>
                                        </div>,
                                        entryCard,
                                    ];
                                }
                                return [entryCard];
                            })}
                        </div>
                    )}
                    {unterDeleteId ? (
                        <ConfirmOrInline
                            area="patient_akte_untersuchung_delete"
                            open={!!unterDeleteId}
                            inlineId="ak-unter-delete-panel"
                            title={t("patient.detail.unter.delete_title")}
                            message={
                                deleteTarget
                                    ? tp("patient.detail.tab.unter.delete_message", {
                                          datetime: formatDateTime(deleteTarget.created_at),
                                          diagnosis: deleteTarget.diagnose || emDash,
                                      })
                                    : t("patient.detail.tab.unter.delete_message_generic")
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
