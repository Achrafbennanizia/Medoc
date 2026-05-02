import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createZahlung, listZahlungenForPatient } from "../../controllers/zahlung.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { getAkte, listBehandlungen, listUntersuchungen } from "../../controllers/akte.controller";
import { errorMessage, formatCurrency, formatDate } from "../../lib/utils";
import { allowed, parseRole } from "../../lib/rbac";
import type { Behandlung, Patient, Untersuchung, Zahlung, ZahlungsArt } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { PatientComboField } from "../components/patient-combo-field";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { ChevronLeftIcon } from "@/lib/icons";
import { Badge } from "../components/ui/badge";
import {
    ZAHLUNG_ART_SELECT,
    ZAHL_EUR_EPS,
    buildOpenZahlLinkSelectOptions,
    formatZahlungBezugLine,
    maxNeuZahlungBehandlung,
    roundMoney2,
    sumZahlungenForBehandlung,
    sumZahlungenForUntersuchung,
    zahlHistoryForBehandlung,
    zahlHistoryForUntersuchung,
    zahlStatusDisplay,
    zahlungsartLabel,
} from "@/lib/zahlung-buchung";

type LinkKind = "" | "behand" | "unter";

function ZahlFinanzenOrPageWrap({
    isFinanzen,
    onClose,
    children,
}: {
    isFinanzen: boolean;
    onClose: () => void;
    children: ReactNode;
}) {
    if (!isFinanzen) return <>{children}</>;
    return (
        <Card className="produkte-detail-card zahl-finanzen-embed card--overflow-visible">
            <CardHeader
                title="Neue Zahlung"
                subtitle="Erfassung neben der Transaktionsliste — nicht auf einer separaten Route (wie Produkte)."
                action={(
                    <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                        Schließen
                    </Button>
                )}
            />
            <div className="card-pad zahl-finanzen-embed__body">{children}</div>
        </Card>
    );
}

export type ZahlungCreatePanelProps = {
    /** `page` = volle Route; `finanzen` = Legacy-Einbettung (nur falls wieder verwendet). */
    variant?: "page" | "finanzen";
    onFinanzenSaved?: () => void;
    onFinanzenClose?: () => void;
};

function ZahlungCreatePanelInner({ variant, onFinanzenSaved, onFinanzenClose }: ZahlungCreatePanelProps) {
    const isFinanzenEmbed = variant === "finanzen";
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = session?.rolle ? parseRole(session.rolle) : null;
    const canListLines = role != null && allowed("patient.behandlungen_list_for_zahlung", role);

    const initialPatient = isFinanzenEmbed ? "" : (searchParams.get("patient_id") ?? "");

    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [behandlungen, setBehandlungen] = useState<Behandlung[]>([]);
    const [untersuchungen, setUntersuchungen] = useState<Untersuchung[]>([]);
    const [zahlungenPatient, setZahlungenPatient] = useState<Zahlung[]>([]);
    const [akteLoading, setAkteLoading] = useState(false);
    const [listLoading, setListLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [patientId, setPatientId] = useState(initialPatient);
    const [linkKind, setLinkKind] = useState<LinkKind>("");
    const [linkId, setLinkId] = useState("");
    const [betrag, setBetrag] = useState("");
    const [zahlungsart, setZahlungsart] = useState<ZahlungsArt>("BAR");
    const [beschreibung, setBeschreibung] = useState("");

    const fromFinanzen = isFinanzenEmbed || searchParams.get("from") !== "patient";

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setListLoading(true);
            setLoadError(null);
            try {
                setPatienten(await listPatienten());
            } catch (e) {
                if (!cancelled) setLoadError(errorMessage(e));
            } finally {
                if (!cancelled) setListLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    /** Monotonic id so stale akte/zahl responses cannot overwrite state after patient switch. */
    const akteFetchSeq = useRef(0);

    useEffect(() => {
        if (!patientId || !canListLines) {
            setBehandlungen([]);
            setUntersuchungen([]);
            setZahlungenPatient([]);
            setLinkKind("");
            setLinkId("");
            setAkteLoading(false);
            return;
        }
        const reqId = ++akteFetchSeq.current;
        setAkteLoading(true);
        setFormError(null);
        void (async () => {
            try {
                const a = await getAkte(patientId);
                const [bh, u, zPat] = await Promise.all([
                    listBehandlungen(a.id),
                    listUntersuchungen(a.id),
                    listZahlungenForPatient(patientId),
                ]);
                if (akteFetchSeq.current !== reqId) return;
                setBehandlungen(bh);
                setUntersuchungen(u);
                setZahlungenPatient(zPat);
            } catch (e) {
                if (akteFetchSeq.current !== reqId) return;
                setFormError(errorMessage(e));
                setBehandlungen([]);
                setUntersuchungen([]);
                setZahlungenPatient([]);
            } finally {
                if (akteFetchSeq.current === reqId) setAkteLoading(false);
            }
        })();
    }, [patientId, canListLines]);

    const zahlungenPatientSorted = useMemo(
        () => [...zahlungenPatient].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        [zahlungenPatient],
    );

    const zahlLinkOptions = useMemo(() => {
        if (!patientId) return [{ value: "", label: "—" }];
        return buildOpenZahlLinkSelectOptions(zahlungenPatient, patientId, behandlungen, untersuchungen);
    }, [patientId, zahlungenPatient, behandlungen, untersuchungen]);

    useEffect(() => {
        if (!patientId || !linkKind || !linkId) return;
        const v = `${linkKind}:${linkId}`;
        if (!zahlLinkOptions.some((o) => o.value === v)) {
            setLinkKind("");
            setLinkId("");
        }
    }, [patientId, linkKind, linkId, zahlLinkOptions]);

    const zahlLinkValue = linkKind && linkId ? `${linkKind}:${linkId}` : "";

    const zahlNeuMaxBetragEur = useMemo(() => {
        if (!patientId || linkKind !== "behand" || !linkId) return null;
        const selBh = behandlungen.find((b) => b.id === linkId);
        const gesamt =
            selBh?.gesamtkosten != null && Number.isFinite(selBh.gesamtkosten) ? selBh.gesamtkosten : null;
        return maxNeuZahlungBehandlung(zahlungenPatient, patientId, linkId, gesamt);
    }, [patientId, linkKind, linkId, behandlungen, zahlungenPatient]);

    function onPatientChange(id: string) {
        setPatientId(id);
        setLinkKind("");
        setLinkId("");
        setBetrag("");
        if (!isFinanzenEmbed) {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (id) next.set("patient_id", id);
                else next.delete("patient_id");
                return next;
            }, { replace: true });
        }
    }

    function onZahlungLinkChange(raw: string) {
        if (!raw) {
            setLinkKind("");
            setLinkId("");
            return;
        }
        const i = raw.indexOf(":");
        const kind = raw.slice(0, i) as "behand" | "unter";
        const rest = raw.slice(i + 1);
        setLinkKind(kind);
        setLinkId(rest);
    }

    const submit = async () => {
        if (!canListLines) {
            setFormError("Keine Berechtigung für Zahlungszuordnung.");
            return;
        }
        if (!patientId) {
            setFormError("Bitte einen Patienten wählen.");
            return;
        }
        if (!linkKind || !linkId.trim()) {
            setFormError("Bitte eine Behandlung (B) oder Untersuchung (U) zuordnen.");
            return;
        }
        const betragN = Number(String(betrag).replace(",", "."));
        if (!Number.isFinite(betragN) || betragN <= 0) {
            setFormError("Bitte gültigen Zahlbetrag eingeben.");
            return;
        }
        const selBh = linkKind === "behand" ? behandlungen.find((b) => b.id === linkId) : undefined;
        const gesamt =
            selBh?.gesamtkosten != null && Number.isFinite(selBh.gesamtkosten) ? selBh.gesamtkosten : null;
        const paidSoFar = linkKind === "behand" && linkId
            ? sumZahlungenForBehandlung(zahlungenPatient, patientId, linkId)
            : 0;
        let openBefore: number | undefined;
        if (linkKind === "behand" && linkId && gesamt != null && Number.isFinite(gesamt)) {
            openBefore = Math.max(0, roundMoney2(gesamt - paidSoFar));
        } else {
            openBefore = undefined;
        }
        if (linkKind === "behand" && openBefore != null && betragN > openBefore + ZAHL_EUR_EPS) {
            setFormError(
                `Der Zahlbetrag darf den offenen Betrag (${formatCurrency(openBefore)}) nicht übersteigen.`,
            );
            return;
        }

        setBusy(true);
        setFormError(null);
        try {
            await createZahlung({
                patient_id: patientId,
                betrag: betragN,
                zahlungsart,
                beschreibung: beschreibung.trim() || undefined,
                behandlung_id: linkKind === "behand" ? linkId : undefined,
                untersuchung_id: linkKind === "unter" ? linkId : undefined,
                betrag_erwartet: openBefore,
            });
            toast("Zahlung erfasst", "success");
            if (isFinanzenEmbed && onFinanzenSaved) {
                onFinanzenSaved();
                return;
            }
            const from = searchParams.get("from");
            if (from === "patient" && patientId) {
                navigate(`/patienten/${patientId}#zahl`);
            } else {
                navigate("/finanzen");
            }
        } catch (e) {
            setFormError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const retryLoadPatienten = () => {
        setLoadError(null);
        setListLoading(true);
        void (async () => {
            try {
                setPatienten(await listPatienten());
                setLoadError(null);
            } catch (e) {
                setLoadError(errorMessage(e));
            } finally {
                setListLoading(false);
            }
        })();
    };

    if (listLoading) {
        return isFinanzenEmbed ? (
            <div className="card produkte-detail-card" style={{ padding: 20 }}>
                <PageLoading label="Daten werden geladen…" />
            </div>
        ) : (
            <PageLoading label="Daten werden geladen…" />
        );
    }
    if (loadError) {
        return isFinanzenEmbed ? (
            <div className="card produkte-detail-card" style={{ padding: 8 }}>
                <PageLoadError message={loadError} onRetry={retryLoadPatienten} />
            </div>
        ) : (
            <PageLoadError message={loadError} onRetry={retryLoadPatienten} />
        );
    }

    const backTarget = fromFinanzen ? "/finanzen" : patientId ? `/patienten/${patientId}#zahl` : "/finanzen";
    const handleCancel = () => {
        if (isFinanzenEmbed && onFinanzenClose) onFinanzenClose();
        else navigate(backTarget);
    };
    const hasClinicalLines = behandlungen.length + untersuchungen.length > 0;
    const noLinks = !canListLines || !patientId || akteLoading || zahlLinkOptions.length <= 1;
    const disabledBehandNoOpen =
        linkKind === "behand" && zahlNeuMaxBetragEur != null && zahlNeuMaxBetragEur <= ZAHL_EUR_EPS;

    return (
        <div
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
            className={isFinanzenEmbed ? undefined : "animate-fade-in"}
        >
            {!isFinanzenEmbed ? (
                <div className="page-head">
                    <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <Button type="button" variant="secondary" onClick={() => navigate(backTarget)}>
                            <ChevronLeftIcon />
                            Zurück
                        </Button>
                        <div>
                            <div className="page-sub">Finanzen</div>
                            <h2 className="page-title" style={{ margin: 0 }}>Neue Zahlung</h2>
                        </div>
                    </div>
                </div>
            ) : null}

            {!canListLines ? (
                <Card>
                    <CardHeader
                        title="Keine Berechtigung"
                        subtitle="Zahlungen mit Zuordnung zu Behandlung/Untersuchung sind für Ihre Rolle nicht verfügbar."
                    />
                </Card>
            ) : (
                <ZahlFinanzenOrPageWrap isFinanzen={isFinanzenEmbed} onClose={handleCancel}>
                    <div
                        className="zahl-create-grid"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr)",
                            gap: 16,
                            alignItems: "start",
                        }}
                    >
                        <div
                            id="ak-zahl-neu-panel-finanzen"
                            className="akte-inline-panel"
                            role="region"
                            aria-label="Neue Zahlung"
                        >
                            {!isFinanzenEmbed ? (
                                <div className="akte-inline-panel-head">
                                    <div>
                                        <div className="akte-inline-panel-title">Neue Zahlung</div>
                                        <div className="akte-inline-panel-sub">
                                            Gleiche Logik wie „Kundenleistungen &amp; Abrechnung“: Zuordnung über{" "}
                                            <strong>B-Nr.</strong> / <strong>U-Nr.</strong> (Behandlungs- bzw. Untersuchungszeile
                                            in der Akte). Die Nummern sind die Referenz zur Zeile — nicht die Zahlungsnotiz.
                                            Bei Behandlungen mit Sollkosten darf nicht mehr gezahlt werden als offen; der Server
                                            prüft das zusätzlich.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p
                                    className="page-sub"
                                    style={{ margin: "0 0 8px", fontSize: 12.5, lineHeight: 1.5 }}
                                >
                                    Gleiche Prüflogik wie die volle Seite: B-Nr. / U-Nr., Soll, offener Betrag.
                                </p>
                            )}
                        <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                            {formError ? (
                                <p
                                    role="alert"
                                    style={{
                                        color: "var(--red)",
                                        fontSize: 12.5,
                                        margin: 0,
                                        padding: "8px 12px",
                                        background: "var(--red-soft)",
                                        borderRadius: 8,
                                    }}
                                >
                                    {formError}
                                </p>
                            ) : null}
                            <PatientComboField
                                id="zc-patient"
                                label="Patient *"
                                patienten={patienten}
                                patientId={patientId}
                                onPatientIdChange={onPatientChange}
                            />
                            {patientId && !akteLoading ? (
                                <div
                                    className="rounded-lg px-4 py-3"
                                    style={{
                                        border: "1px solid var(--line)",
                                        background: "rgba(0,0,0,0.02)",
                                    }}
                                >
                                    <div className="form-label form-label--wide form-label--mb-10">
                                        Bisherige Zahlungen (dieser Patient)
                                    </div>
                                    <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--fg-3)" }}>
                                        Überblick vor neuer Buchung — Abgleich mit B-Nr./U-Nr. (nicht bloß dem Notizfeld).
                                    </p>
                                    {zahlungenPatientSorted.length === 0 ? (
                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                            Noch keine Zahlungen in dieser Akte.
                                        </p>
                                    ) : (
                                        <div className="zahl-hist-table-wrap" style={{ overflow: "auto", maxHeight: 220 }}>
                                            <table className="tbl zahl-hist-tbl" style={{ width: "100%", fontSize: 12.5 }}>
                                                <thead>
                                                    <tr>
                                                        <th scope="col" style={{ width: "20%" }}>Datum</th>
                                                        <th scope="col" style={{ width: "38%" }}>Bezug (B-Nr. / U-Nr.)</th>
                                                        <th scope="col" style={{ textAlign: "right", width: "18%" }}>Betrag</th>
                                                        <th scope="col" style={{ width: "12%" }}>Art</th>
                                                        <th scope="col" style={{ width: "12%" }}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {zahlungenPatientSorted.map((z) => {
                                                        const st = zahlStatusDisplay(z.status);
                                                        return (
                                                            <tr key={z.id}>
                                                                <td>{formatDate(z.created_at)}</td>
                                                                <td style={{ lineHeight: 1.35 }}>{formatZahlungBezugLine(z, behandlungen, untersuchungen)}</td>
                                                                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(z.betrag)}</td>
                                                                <td>{zahlungsartLabel(z.zahlungsart)}</td>
                                                                <td><Badge variant={st.variant}>{st.label}</Badge></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                            {akteLoading ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>Behandlungen werden geladen…</p>
                            ) : null}
                            {noLinks && patientId && !akteLoading && !hasClinicalLines ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    Es sind noch keine Behandlungen oder Untersuchungen in dieser Akte — bitte zuerst
                                    klinische Einträge anlegen, dann die Zahlung zuordnen.
                                </p>
                            ) : null}
                            {noLinks && patientId && !akteLoading && hasClinicalLines ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    Keine offene Zuordnung: Alle Behandlungssollen dieser Akte sind ausgeglichen.
                                </p>
                            ) : null}
                            <Select
                                id="zc-zahl-link"
                                label="Zuordnung (nur offene Zeilen) *"
                                value={zahlLinkValue}
                                options={zahlLinkOptions}
                                disabled={!patientId || noLinks || akteLoading}
                                onChange={(e) => onZahlungLinkChange(e.target.value)}
                            />
                            {linkKind && linkId && patientId ? (
                                linkKind === "behand"
                                    ? (() => {
                                        const selBh = behandlungen.find((b) => b.id === linkId);
                                        const gesamt =
                                            selBh?.gesamtkosten != null && Number.isFinite(selBh.gesamtkosten)
                                                ? selBh.gesamtkosten
                                                : null;
                                        const hist = zahlHistoryForBehandlung(zahlungenPatient, patientId, linkId);
                                        const paidSum = sumZahlungenForBehandlung(
                                            zahlungenPatient,
                                            patientId,
                                            linkId,
                                        );
                                        const openNow = gesamt != null && gesamt > 0 ? Math.max(0, gesamt - paidSum) : null;
                                        const betragN = Number(String(betrag).replace(",", "."));
                                        const add = Number.isFinite(betragN) && betragN > 0 ? betragN : 0;
                                        const openAfter =
                                            gesamt != null && gesamt > 0 ? Math.max(0, gesamt - paidSum - add) : null;
                                        const previewCase =
                                            gesamt != null && gesamt > 0 && openAfter != null
                                                ? openAfter <= ZAHL_EUR_EPS
                                                    ? "BEZAHLT"
                                                    : "TEILBEZAHLT"
                                                : "BEZAHLT";
                                        return (
                                            <>
                                                <div
                                                    className="rounded-lg px-4 py-3"
                                                    style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                                                >
                                                    <div className="form-label form-label--wide form-label--mb-10">
                                                        Kosten & offener Betrag (Behandlung)
                                                    </div>
                                                    <div
                                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                                        style={{ fontSize: 14 }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Kosten (Soll)</div>
                                                            <div style={{ fontWeight: 700 }}>{gesamt != null ? formatCurrency(gesamt) : "—"}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Bereits gezahlt</div>
                                                            <div style={{ fontWeight: 600 }}>{formatCurrency(paidSum)}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Offen jetzt</div>
                                                            <div
                                                                style={{
                                                                    fontWeight: 700,
                                                                    color: openNow != null && openNow > 0 ? "var(--fg-1)" : "var(--fg-3)",
                                                                }}
                                                            >
                                                                {openNow != null ? formatCurrency(openNow) : "—"}
                                                            </div>
                                                        </div>
                                                        {add > 0 && openAfter != null ? (
                                                            <div>
                                                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                                                    Nach dieser Zahlung offen
                                                                </div>
                                                                <div style={{ fontWeight: 600 }}>{formatCurrency(openAfter)}</div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="form-label form-label--wide">
                                                        Zahlungsverlauf zu dieser Zeile
                                                    </div>
                                                    {hist.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                            {hist.map((h) => {
                                                                const hs = zahlStatusDisplay(h.status);
                                                                return (
                                                                    <li key={h.id}>
                                                                        {formatDate(h.created_at)}
                                                                        {" · "}
                                                                        {formatCurrency(h.betrag)}
                                                                        {" · "}
                                                                        <Badge variant={hs.variant}>{hs.label}</Badge>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                                            Noch keine Buchung zu dieser Behandlungszeile.
                                                        </p>
                                                    )}
                                                </div>
                                                <div
                                                    className="row"
                                                    style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}
                                                >
                                                    <span style={{ fontSize: 13, color: "var(--fg-3)" }}>
                                                        Fall nach Speichern (Soll vs. Summe):
                                                    </span>
                                                    <Badge
                                                        variant={previewCase === "BEZAHLT"
                                                            ? "success"
                                                            : previewCase === "TEILBEZAHLT"
                                                            ? "warning"
                                                            : "default"}
                                                    >
                                                        {previewCase === "BEZAHLT"
                                                            ? "Ausgeglichen"
                                                            : previewCase === "TEILBEZAHLT"
                                                            ? "Noch offen"
                                                            : previewCase}
                                                    </Badge>
                                                </div>
                                            </>
                                        );
                                    })()
                                    : (() => {
                                        const histU = zahlHistoryForUntersuchung(
                                            zahlungenPatient,
                                            patientId,
                                            linkId,
                                        );
                                        const paidU = sumZahlungenForUntersuchung(
                                            zahlungenPatient,
                                            patientId,
                                            linkId,
                                        );
                                        return (
                                            <>
                                                <div
                                                    className="rounded-lg px-4 py-3"
                                                    style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                                                >
                                                    <div className="form-label form-label--wide form-label--mb-8">
                                                        Untersuchung (ohne Sollkosten)
                                                    </div>
                                                    <div
                                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                                        style={{ fontSize: 14 }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Kosten (Soll)</div>
                                                            <div style={{ fontWeight: 600 }}>—</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Bereits gezahlt (Summe)</div>
                                                            <div style={{ fontWeight: 600 }}>{formatCurrency(paidU)}</div>
                                                        </div>
                                                    </div>
                                                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                                        Einzelbuchungen werden ohne Restbetrag gegen ein Soll geführt; der Verlauf
                                                        zeigt alle Zahlungen zu dieser Untersuchung.
                                                    </p>
                                                </div>
                                                <div>
                                                    <div className="form-label form-label--wide">
                                                        Zahlungsverlauf
                                                    </div>
                                                    {histU.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                            {histU.map((h) => {
                                                                const hu = zahlStatusDisplay(h.status);
                                                                return (
                                                                <li key={h.id}>
                                                                    {formatDate(h.created_at)}
                                                                    {" · "}
                                                                    {formatCurrency(h.betrag)}
                                                                    {" · "}
                                                                    <Badge variant={hu.variant}>{hu.label}</Badge>
                                                                </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                                            Noch keine Zahlung zu dieser Untersuchung.
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()
                            ) : null}
                            <div>
                                <Input
                                    id="zc-betrag"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={zahlNeuMaxBetragEur != null ? zahlNeuMaxBetragEur : undefined}
                                    label="Zahlbetrag (€) *"
                                    value={betrag}
                                    onChange={(e) => setBetrag(e.target.value)}
                                    onBlur={(e) => {
                                        if (zahlNeuMaxBetragEur == null) return;
                                        const n = Number(String(e.target.value).replace(",", "."));
                                        if (!Number.isFinite(n) || n <= 0) return;
                                        if (n > zahlNeuMaxBetragEur + ZAHL_EUR_EPS) {
                                            setBetrag(String(roundMoney2(zahlNeuMaxBetragEur)));
                                            toast(
                                                `Betrag auf maximal ${formatCurrency(zahlNeuMaxBetragEur)} begrenzt (offener Betrag).`,
                                                "info",
                                            );
                                        }
                                    }}
                                />
                                {zahlNeuMaxBetragEur != null ? (
                                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                        Höchstens {formatCurrency(zahlNeuMaxBetragEur)} (aktuell offen für diese Behandlung).
                                    </p>
                                ) : null}
                            </div>
                            <Select
                                id="zc-art"
                                label="Zahlungsart"
                                value={zahlungsart}
                                onChange={(e) => setZahlungsart(e.target.value as ZahlungsArt)}
                                options={[...ZAHLUNG_ART_SELECT]}
                            />
                            <div>
                                <Textarea
                                    id="zc-beschr"
                                    label="Beschreibung (optional)"
                                    rows={2}
                                    value={beschreibung}
                                    onChange={(e) => setBeschreibung(e.target.value)}
                                />
                                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                    Interne Notiz. Die fachliche Zuordnung der Zahlung erfolgt über B-Nr. / U-Nr. oben.
                                </p>
                            </div>
                            <div className="akte-inline-panel-actions" style={{ flexWrap: "wrap", gap: 10 }}>
                                {linkKind === "behand" && disabledBehandNoOpen ? (
                                    <span style={{ fontSize: 12, color: "var(--fg-3)", flex: "1 1 200px" }}>
                                        Für diese Behandlung ist kein weiterer Betrag offen (Soll bereits gedeckt).
                                    </span>
                                ) : null}
                                <Button type="button" variant="ghost" onClick={handleCancel} disabled={busy}>
                                    Abbrechen
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => void submit()}
                                    disabled={
                                        busy
                                        || !patientId
                                        || !linkKind
                                        || !linkId
                                        || disabledBehandNoOpen
                                        || akteLoading
                                    }
                                >
                                    Zahlung speichern
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                </ZahlFinanzenOrPageWrap>
            )}
        </div>
    );
}

export function ZahlungCreatePanel(p: ZahlungCreatePanelProps) {
    return <ZahlungCreatePanelInner {...p} variant={p.variant ?? "page"} />;
}

export function ZahlungCreatePage() {
    return <ZahlungCreatePanelInner variant="page" />;
}
