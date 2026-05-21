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
    onStartNewBehandlung,
    onContinueBehandlung,
    onReleaseForBilling,
    onOpenEditBehandlung,
    onRequestDeleteBehandlung,
    onCancelDeleteBehandlung,
    onConfirmDeleteBehandlung,
}: PatientDetailBehandTabProps) {
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
                            Behandlungen (Verlauf)
                        </h3>
                    </div>
                    {!showBehandComposer ? (
                        <div
                            className="row"
                            style={{ gap: 12, flexWrap: "wrap", marginBottom: behandlungen.length === 0 ? 0 : 16 }}
                            role="group"
                            aria-label="Behandlung starten"
                        >
                            <Button
                                type="button"
                                variant="primary"
                                onClick={onStartNewBehandlung}
                                style={{ minWidth: 200 }}
                            >
                                + Neue Behandlung
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={behandlungen.length === 0}
                                onClick={onContinueBehandlung}
                                style={{ minWidth: 200 }}
                            >
                                Behandlung fortsetzen
                            </Button>
                            <span style={{ alignSelf: "center", fontSize: 12, color: "var(--fg-3)", flexBasis: "100%" }}>
                                Fortsetzen übernimmt Leistung aus Katalog automatisch von der gewählten Sitzung. Standard:
                                zuletzt dokumentierte Sitzung.
                            </span>
                        </div>
                    ) : null}
                    {showBehandComposer && !behandEditId ? (
                        <BehandlungAkteComposerPanel {...behandComposerCommon} />
                    ) : null}
                    {behandlungen.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", marginTop: 4 }}>Noch keine Behandlungen.</p>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table className="tbl tbl-behand-groups">
                                <thead>
                                    <tr>
                                        <th>Datum</th>
                                        <th>Zahnnummer</th>
                                        <th>Kategorie</th>
                                        <th>Leistungsname</th>
                                        <th>Sitzung</th>
                                        <th>B.Nummer</th>
                                        <th>Abrechnung</th>
                                        <th style={{ width: 220 }}>Aktion</th>
                                    </tr>
                                </thead>
                                {behandlungGroups.map((grp) => (
                                    <tbody key={grp[0]?.id ?? grp.map((x) => x.id).join()} className="behand-grp">
                                        {grp.map((b) => (
                                            <Fragment key={b.id}>
                                                {showBehandComposer && behandEditId === b.id ? (
                                                    <tr>
                                                        <td
                                                            colSpan={8}
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
                                                    <td>{b.zaehne || "—"}</td>
                                                    <td>{b.kategorie || b.art}</td>
                                                    <td>{b.leistungsname || b.beschreibung || b.art}</td>
                                                    <td>{b.sitzung != null ? `Nr. ${b.sitzung}` : "—"}</td>
                                                    <td>{b.behandlungsnummer || "—"}</td>
                                                    <td>
                                                        {b.freigegeben_von_arzt_id && (b.freigegeben_am ?? "").trim() !== "" ? (
                                                            <Badge variant="primary">Freigegeben</Badge>
                                                        ) : (
                                                            <Badge variant="warning">Ausstehend</Badge>
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
                                                                    Freigeben
                                                                </Button>
                                                            ) : null}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => onOpenEditBehandlung(b)}
                                                            >
                                                                Bearbeiten
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                onClick={() => onRequestDeleteBehandlung(b.id)}
                                                            >
                                                                Löschen
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
                        title="Behandlung löschen"
                        message={
                            deleteTarget
                                ? `Die Zeile „${deleteTarget.leistungsname || deleteTarget.beschreibung || deleteTarget.art || "—"}“ (Sitzung ${deleteTarget.sitzung != null ? deleteTarget.sitzung : "—"}) wirklich entfernen?`
                                : "Diese Behandlungszeile wirklich entfernen?"
                        }
                        onCancel={onCancelDeleteBehandlung}
                        onConfirm={() => void onConfirmDeleteBehandlung()}
                        confirmLabel="Ja, löschen"
                        danger
                    />
                ) : null}
            </div>
        </div>
    );
}
