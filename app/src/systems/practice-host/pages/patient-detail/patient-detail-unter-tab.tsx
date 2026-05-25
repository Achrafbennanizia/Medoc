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
    const deleteTarget = unterDeleteId
        ? untersuchungen.find((x) => x.id === unterDeleteId)
        : undefined;

    return (
        <div id="panel-unter" role="tabpanel" aria-labelledby="tab-unter">
            <div className="col" style={{ gap: 16 }}>
                <Card className="card-pad">
                    <CardHeader
                        title="Untersuchungen"
                        action={(
                            <Button size="sm" disabled={showUnterComposer} onClick={onStartNewUntersuchung}>
                                {showUnterComposer ? "Erfassung aktiv…" : "Neue Untersuchung"}
                            </Button>
                        )}
                    />
                    {untersuchungen.length === 0 ? (
                        <p style={{ color: "var(--fg-3)" }}>Keine Untersuchungen.</p>
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
                                                        ? `U ${(u.untersuchungsnummer ?? "").trim()}`
                                                        : "U —"}
                                                    {" · "}
                                                    {formatDateTime(u.created_at)}
                                                </div>
                                                <div style={{ fontWeight: 600 }}>{u.diagnose || detail?.diagnosis || "Diagnose offen"}</div>
                                                {(u.leistungsname ?? "").trim() ? (
                                                    <div style={{ fontSize: 13, color: "var(--fg-2)" }}>
                                                        {(u.kategorie ?? "").trim() ? `${u.kategorie} · ` : ""}
                                                        {u.leistungsname}
                                                        {u.gesamtkosten != null && Number.isFinite(u.gesamtkosten)
                                                            ? ` · ${u.gesamtkosten.toFixed(2)} €`
                                                            : ""}
                                                    </div>
                                                ) : null}
                                                <div style={{ color: "var(--fg-3)", fontSize: 13 }}>
                                                    {u.beschwerden || detail?.chiefComplaint || "—"}
                                                </div>
                                                <div className="row" style={{ gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                                                    {u.freigegeben_von_arzt_id && (u.freigegeben_am ?? "").trim() !== "" ? (
                                                        <Badge variant="primary">Abrechnung freigegeben</Badge>
                                                    ) : (
                                                        <Badge variant="warning">Abrechnung ausstehend</Badge>
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
                                                        Zur Abrechnung freigeben
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onToggleDetail(u.id, open)}
                                                >
                                                    {open ? "Detail schließen" : "Detail anzeigen"}
                                                </Button>
                                                <Button type="button" variant="ghost" size="sm" onClick={() => onStartEdit(u)}>
                                                    Bearbeiten
                                                </Button>
                                                <Button type="button" variant="danger" size="sm" onClick={() => onRequestDelete(u.id)}>
                                                    Löschen
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
                                                            Klinische Zusammenfassung
                                                        </div>
                                                        <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>
                                                            {detail.diagnosis || u.diagnose || "—"}
                                                        </div>
                                                        {detail.plan ? (
                                                            <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-line" }}>
                                                                <strong>Plan:</strong> {detail.plan}
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
                                                                Hauptbeschwerde
                                                            </div>
                                                            <p style={{ margin: 0, whiteSpace: "pre-line" }}>{detail.chiefComplaint || "—"}</p>
                                                            {detail.painVas ? (
                                                                <div style={{ marginTop: 8, color: "var(--fg-3)" }}>
                                                                    VAS {detail.painVas}/10 · {detail.painLocation || "—"}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                Extraoral
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>TMG: {detail.extraoral.tmj || "—"}</p>
                                                            <p style={{ margin: "4px 0" }}>Lymphknoten: {detail.extraoral.lymphNodes || "—"}</p>
                                                            <p style={{ margin: "4px 0" }}>Asymmetrie: {detail.extraoral.asymmetry || "—"}</p>
                                                        </div>
                                                        <div
                                                            style={{
                                                                padding: 14,
                                                                borderBottom: "1px solid var(--line)",
                                                                borderRight: "1px solid var(--line)",
                                                            }}
                                                        >
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                Intraoral
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>Schleimhaut: {detail.intraoral.mucosa || "—"}</p>
                                                            <p style={{ margin: "4px 0" }}>Zunge: {detail.intraoral.tongue || "—"}</p>
                                                            <p style={{ margin: "4px 0" }}>Gingiva: {detail.intraoral.gingiva || "—"}</p>
                                                        </div>
                                                        <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                Parodontal
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>
                                                                PSI: {Object.values(detail.psi).filter(Boolean).join(" / ") || "—"}
                                                            </p>
                                                            <p style={{ margin: "4px 0" }}>
                                                                BOP {detail.bopPercent || "—"} % · PI {detail.plaqueIndex || "—"} · MH{" "}
                                                                {detail.hygieneScore || "—"}
                                                            </p>
                                                        </div>
                                                        <div style={{ padding: 14, borderRight: "1px solid var(--line)" }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                Funktion
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>CMD: {detail.function.cmd || "—"}</p>
                                                            <p style={{ margin: "4px 0" }}>Bruxismus: {detail.function.bruxism || "—"}</p>
                                                            <p style={{ margin: "4px 0", whiteSpace: "pre-line" }}>{detail.function.notes || ""}</p>
                                                        </div>
                                                        <div style={{ padding: 14 }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                                                                Bildgebung
                                                            </div>
                                                            <p style={{ margin: "4px 0" }}>Angeordnet: {detail.imaging.ordered || "—"}</p>
                                                            <p style={{ margin: "4px 0", whiteSpace: "pre-line" }}>{detail.imaging.findings || "—"}</p>
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
                                                    {u.ergebnisse || "Keine strukturierten Daten."}
                                                </pre>
                                            )
                                        ) : null}
                                    </div>
                                );
                                if (unterEdit?.id === u.id && akte) {
                                    return [
                                        <div key={`${u.id}-edit`} className="unter-stack-edit-slot">
                                            <AkteInlineEditPanelShell
                                                id={`ak-unter-edit-${u.id}`}
                                                ariaLabel="Untersuchung bearbeiten"
                                                title="Untersuchung bearbeiten"
                                                subtitle={(
                                                    <>
                                                        {(unterEdit.untersuchungsnummer ?? "").trim()
                                                            ? `U ${(unterEdit.untersuchungsnummer ?? "").trim()} · `
                                                            : null}
                                                        Gleiche strukturierte Erfassung wie bei „Neue Untersuchung“ — Abschnitte per Chips
                                                        wechseln.
                                                        {!unterEditUnlocked ? " Zum Ändern „Bearbeiten“ wählen." : null}
                                                    </>
                                                )}
                                                headerExtra={
                                                    !unterEditUnlocked ? (
                                                        <Button type="button" variant="secondary" size="sm" onClick={onUnlockEdit}>
                                                            Bearbeiten
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
                            title="Untersuchung löschen"
                            message={
                                deleteTarget
                                    ? `Eintrag vom ${formatDateTime(deleteTarget.created_at)} mit Diagnose „${deleteTarget.diagnose || "—"}“ wirklich entfernen?`
                                    : "Diesen Untersuchungseintrag wirklich entfernen?"
                            }
                            onCancel={onCancelDelete}
                            onConfirm={() => void onConfirmDelete()}
                            confirmLabel="Ja, löschen"
                            danger
                        />
                    ) : null}
                    {akte && showUnterComposer ? (
                        <div className="akte-inline-panel" role="region" aria-label="Neue Untersuchung">
                            <div className="akte-inline-panel-head">
                                <div>
                                    <div className="akte-inline-panel-title">Neue Untersuchung</div>
                                    <div className="akte-inline-panel-sub">
                                        Vorgesehene Nummer: <strong>{nextUnterPreview}</strong>
                                        {" — "}
                                        strukturierte Erfassung, erscheint im Verlauf dieser Akte.
                                    </div>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={onCloseComposer}>
                                    Schließen
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
                </Card>
            </div>
        </div>
    );
}
