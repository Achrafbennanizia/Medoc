import { useT, useTParams } from "@/lib/i18n";
import type { BehandlungsKatalogItem, Patientenakte, Untersuchung, Zahnbefund } from "@/models/types";
import {
    UntersuchungBillingFields,
    type UntersuchungBillingFormState,
} from "@/views/components/untersuchung-billing-fields";
import { parseUntersuchungV1 } from "@/lib/untersuchung";
import type { UntersuchungSubmit } from "@/views/components/UntersuchungComposer";
import { formatDateTime } from "@/lib/utils";
import { AkteInlineEditPanelShell, ConfirmOrInline } from "@/views/components/akte-confirm-presentation";
import { UntersuchungComposer } from "@/views/components/UntersuchungComposer";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";

export type PatientDetailUnterTabProps = {
    akte: Patientenakte | null;
    befunde: Zahnbefund[];
    untersuchungen: Untersuchung[];
    showUnterComposer: boolean;
    nextUnterPreview: string;
    unterDetailId: string | null;
    unterEdit: Untersuchung | null;
    unterEditUnlocked: boolean;
    unterDeleteId: string | null;
    canViewClinical: boolean;
    showClinicalPrices: boolean;
    onToggleClinicalPrices: () => void;
    katalog: BehandlungsKatalogItem[];
    unterBillingForm: UntersuchungBillingFormState;
    setUnterBillingForm: (next: UntersuchungBillingFormState) => void;
    onStartNewUntersuchung: () => void;
    onToggleDetail: (id: string, open: boolean) => void;
    onReleaseForBilling: (untersuchungId: string) => void | Promise<void>;
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
};

export function PatientDetailUnterTab({
    akte,
    befunde,
    untersuchungen,
    showUnterComposer,
    nextUnterPreview,
    unterDetailId,
    unterEdit,
    unterEditUnlocked,
    unterDeleteId,
    canViewClinical,
    showClinicalPrices,
    onToggleClinicalPrices,
    katalog,
    unterBillingForm,
    setUnterBillingForm,
    onStartNewUntersuchung,
    onToggleDetail,
    onReleaseForBilling,
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
}: PatientDetailUnterTabProps) {
    const t = useT();
    const tp = useTParams();
    const emDash = t("common.em_dash");
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
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
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
                                <Button size="sm" disabled={showUnterComposer} onClick={onStartNewUntersuchung}>
                                    {showUnterComposer
                                        ? t("patient.detail.tab.unter.new_active")
                                        : t("patient.detail.tab.unter.new")}
                                </Button>
                            </div>
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
                                    form={unterBillingForm}
                                    setForm={setUnterBillingForm}
                                />
                                <UntersuchungComposer
                                    befunde={befunde}
                                    onApplyTooth={onApplyTooth}
                                    onCancel={onCloseComposer}
                                    onSave={onCreateUntersuchung}
                                />
                            </div>
                        </div>
                    ) : null}
                    {untersuchungen.length === 0 && !showUnterComposer ? (
                        <p style={{ color: "var(--fg-3)" }}>{t("patient.detail.unter.empty")}</p>
                    ) : (
                        <div className="col unter-stack" style={{ gap: 8 }}>
                            {untersuchungen.flatMap((u) => {
                                const detail = parseUntersuchungV1(u.ergebnisse);
                                const open = unterDetailId === u.id;
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
                                                    {u.diagnose || detail?.diagnosis || t("patient.detail.tab.common.diagnosis_open")}
                                                </div>
                                                {(u.leistungsname ?? "").trim() || showClinicalPrices ? (
                                                    <div style={{ fontSize: 13, color: "var(--fg-2)" }}>
                                                        {(u.kategorie ?? "").trim() ? `${u.kategorie} · ` : ""}
                                                        {(u.leistungsname ?? "").trim() || emDash}
                                                        {showClinicalPrices && u.gesamtkosten != null && Number.isFinite(u.gesamtkosten)
                                                            ? ` · ${u.gesamtkosten.toFixed(2)} €`
                                                            : ""}
                                                    </div>
                                                ) : null}
                                                <div style={{ color: "var(--fg-3)", fontSize: 13 }}>
                                                    {u.beschwerden || detail?.chiefComplaint || emDash}
                                                </div>
                                                <div className="row" style={{ gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                                                    {u.freigegeben_von_arzt_id && (u.freigegeben_am ?? "").trim() !== "" ? (
                                                        <Badge variant="primary">{t("patient.detail.tab.common.billing_released")}</Badge>
                                                    ) : (
                                                        <Badge variant="warning">{t("patient.detail.tab.common.billing_pending")}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                                {canViewClinical
                                                && !(u.freigegeben_von_arzt_id && (u.freigegeben_am ?? "").trim() !== "") ? (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => void onReleaseForBilling(u.id)}
                                                    >
                                                        {t("patient.detail.tab.common.release_billing")}
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
                                            detail ? (
                                                <div
                                                    className="untersuchung-detail-sheet"
                                                    style={{
                                                        marginTop: 14,
                                                        border: "1px solid var(--line)",
                                                        borderRadius: 12,
                                                        overflow: "hidden",
                                                        background: "var(--surface)",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            padding: "14px 16px",
                                                            background: "var(--accent-soft)",
                                                            borderBottom: "1px solid var(--line)",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                fontSize: 11,
                                                                letterSpacing: "0.04em",
                                                                color: "var(--fg-3)",
                                                                textTransform: "uppercase",
                                                            }}
                                                        >
                                                            {t("patient.detail.tab.unter.summary_title")}
                                                        </div>
                                                        <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>
                                                            {detail.diagnosis || u.diagnose || emDash}
                                                        </div>
                                                        {detail.plan ? (
                                                            <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-line" }}>
                                                                <strong>{t("patient.detail.tab.unter.plan_prefix")}</strong> {detail.plan}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0" style={{ fontSize: 13 }}>
                                                        <div
                                                            style={{
                                                                padding: 14,
                                                                borderBottom: "1px solid var(--line)",
                                                                borderRight: "1px solid var(--line)",
                                                            }}
                                                        >
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                {t("patient.detail.tab.unter.chief_complaint")}
                                                            </div>
                                                            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{detail.chiefComplaint || emDash}</p>
                                                            {detail.painVas ? (
                                                                <div style={{ marginTop: 8, color: "var(--fg-3)" }}>
                                                                    {tp("patient.detail.tab.unter.vas_line", {
                                                                        vas: detail.painVas,
                                                                        location: detail.painLocation || emDash,
                                                                    })}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                {t("patient.detail.tab.unter.extraoral")}
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>{t("patient.detail.tab.unter.extraoral.tmj")} {detail.extraoral.tmj || emDash}</p>
                                                            <p style={{ margin: "4px 0" }}>{t("patient.detail.tab.unter.extraoral.lymph")} {detail.extraoral.lymphNodes || emDash}</p>
                                                            <p style={{ margin: "4px 0" }}>{t("patient.detail.tab.unter.extraoral.asymmetry")} {detail.extraoral.asymmetry || emDash}</p>
                                                        </div>
                                                        <div
                                                            style={{
                                                                padding: 14,
                                                                borderBottom: "1px solid var(--line)",
                                                                borderRight: "1px solid var(--line)",
                                                            }}
                                                        >
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                {t("patient.detail.tab.unter.intraoral")}
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>{t("patient.detail.tab.unter.intraoral.mucosa")} {detail.intraoral.mucosa || emDash}</p>
                                                            <p style={{ margin: "4px 0" }}>{t("patient.detail.tab.unter.intraoral.tongue")} {detail.intraoral.tongue || emDash}</p>
                                                            <p style={{ margin: "4px 0" }}>{t("patient.detail.tab.unter.intraoral.gingiva")} {detail.intraoral.gingiva || emDash}</p>
                                                        </div>
                                                        <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                {t("patient.detail.tab.unter.periodontal")}
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>
                                                                {t("patient.detail.tab.unter.periodontal.psi")}{" "}
                                                                {Object.values(detail.psi).filter(Boolean).join(" / ") || emDash}
                                                            </p>
                                                            <p style={{ margin: "4px 0" }}>
                                                                {tp("patient.detail.tab.unter.periodontal.metrics", {
                                                                    bop: detail.bopPercent || emDash,
                                                                    pi: detail.plaqueIndex || emDash,
                                                                    mh: detail.hygieneScore || emDash,
                                                                })}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 14, borderRight: "1px solid var(--line)" }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                {t("patient.detail.tab.unter.function")}
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>{t("patient.detail.tab.unter.function.cmd")} {detail.function.cmd || emDash}</p>
                                                            <p style={{ margin: "4px 0" }}>{t("patient.detail.tab.unter.function.bruxism")} {detail.function.bruxism || emDash}</p>
                                                            <p style={{ margin: "4px 0", whiteSpace: "pre-line" }}>{detail.function.notes || ""}</p>
                                                        </div>
                                                        <div style={{ padding: 14 }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                {t("patient.detail.tab.unter.imaging")}
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>{t("patient.detail.tab.unter.imaging.ordered")} {detail.imaging.ordered || emDash}</p>
                                                            <p style={{ margin: "4px 0", whiteSpace: "pre-line" }}>{detail.imaging.findings || emDash}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <pre
                                                    style={{
                                                        whiteSpace: "pre-wrap",
                                                        marginTop: 12,
                                                        fontSize: 12,
                                                        background: "var(--bg-2, rgba(0,0,0,0.04))",
                                                        padding: 12,
                                                        borderRadius: 8,
                                                    }}
                                                >
                                                    {u.ergebnisse || t("patient.detail.tab.unter.no_structured_data")}
                                                </pre>
                                            )
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
                                                <UntersuchungBillingFields
                                                    katalog={katalog}
                                                    form={unterBillingForm}
                                                    setForm={setUnterBillingForm}
                                                    locked={!unterEditUnlocked}
                                                />
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
