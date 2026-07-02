import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createZahlung, listZahlungenForPatient } from "@/systems/practice-host/controllers/zahlung.controller";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { getAkte, listBehandlungen, listUntersuchungen } from "@/systems/practice-host/controllers/akte.controller";
import { errorMessage, formatCurrency, formatDate } from "@/lib/utils";
import { allowed, parseRole } from "@/lib/rbac";
import type { Behandlung, Patient, Untersuchung, Zahlung, ZahlungsArt } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { PatientComboField } from "../components/patient-combo-field";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { Badge } from "../components/ui/badge";
import {
    zahlungArtSelectOptions,
    ZAHL_EUR_EPS,
    buildOpenZahlLinkSelectOptions,
    formatZahlungBezugLine,
    maxNeuZahlungBehandlung,
    maxNeuZahlungUntersuchung,
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
    embedVariant,
    onClose,
    children,
}: {
    isFinanzen: boolean;
    embedVariant?: "finanzen" | "kasse";
    onClose: () => void;
    children: ReactNode;
}) {
    const t = useT();
    if (!isFinanzen) {
        return (
            <Card className="zahlung-create-page__card card-elevated">
                <CardHeader
                    title={t("zahlung.create.payment_data")}
                    subtitle={t("zahlung.create.subtitle")}
                />
                <div className="card-pad">{children}</div>
            </Card>
        );
    }
    const subtitle =
        embedVariant === "kasse"
            ? t("zahlung.create.embed_kasse_sub")
            : t("zahlung.create.embed_finanzen_sub");
    return (
        <Card className="produkte-detail-card zahl-finanzen-embed card--overflow-visible">
            <CardHeader
                title={t("zahlung.create.title")}
                subtitle={subtitle}
                action={(
                    <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                        {t("common.close")}
                    </Button>
                )}
            />
            <div className="card-pad zahl-finanzen-embed__body">{children}</div>
        </Card>
    );
}

export type ZahlungCreatePanelProps = {
    /** `page` = Finanzen route; `kasse-page` = cash receipts route; `finanzen` / `kasse` = embedded. */
    variant?: "page" | "kasse-page" | "finanzen" | "kasse";
    onFinanzenSaved?: () => void;
    onFinanzenClose?: () => void;
};

function ZahlungCreatePanelInner({ variant, onFinanzenSaved, onFinanzenClose }: ZahlungCreatePanelProps) {
    const t = useT();
    const tp = useTParams();
    const isFinanzenEmbed = variant === "finanzen" || variant === "kasse";
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

    const fromParam = searchParams.get("from");
    const fromKasse = variant === "kasse" || variant === "kasse-page" || fromParam === "kasse";
    const fromFinanzen = isFinanzenEmbed || (fromParam !== "patient" && !fromKasse);

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
        if (!patientId) return [{ value: "", label: t("common.em_dash") }];
        return buildOpenZahlLinkSelectOptions(zahlungenPatient, patientId, behandlungen, untersuchungen, t, tp);
    }, [patientId, zahlungenPatient, behandlungen, untersuchungen, t, tp]);

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
        if (!patientId || !linkId) return null;
        if (linkKind === "behand") {
            const selBh = behandlungen.find((b) => b.id === linkId);
            const gesamt =
                selBh?.gesamtkosten != null && Number.isFinite(selBh.gesamtkosten) ? selBh.gesamtkosten : null;
            return maxNeuZahlungBehandlung(zahlungenPatient, patientId, linkId, gesamt);
        }
        if (linkKind === "unter") {
            const selU = untersuchungen.find((u) => u.id === linkId);
            const gesamt =
                selU?.gesamtkosten != null && Number.isFinite(selU.gesamtkosten) ? selU.gesamtkosten : null;
            return maxNeuZahlungUntersuchung(zahlungenPatient, patientId, linkId, gesamt);
        }
        return null;
    }, [patientId, linkKind, linkId, behandlungen, untersuchungen, zahlungenPatient]);

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
            setFormError(t("zahlung.create.error.no_permission"));
            return;
        }
        if (!patientId) {
            setFormError(t("zahlung.create.error.patient_required"));
            return;
        }
        if (!linkKind || !linkId.trim()) {
            setFormError(t("zahlung.create.error.link_required"));
            return;
        }
        const betragN = Number(String(betrag).replace(",", "."));
        if (!Number.isFinite(betragN) || betragN <= 0) {
            setFormError(t("zahlung.create.error.amount_invalid"));
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
                tp("zahlung.create.error.amount_exceeds", { amount: formatCurrency(openBefore) }),
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
            toast(t("zahlung.create.toast.saved"), "success");
            if (isFinanzenEmbed && onFinanzenSaved) {
                onFinanzenSaved();
                return;
            }
            if (fromKasse) {
                navigate("/finanzen/kasse");
            } else if (fromParam === "patient" && patientId) {
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
                <PageLoading label={t("common.loading_data")} />
            </div>
        ) : (
            <PageLoading label={t("common.loading_data")} />
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

    const backTarget = fromKasse
        ? "/finanzen/kasse"
        : fromFinanzen
          ? "/finanzen"
          : patientId
            ? `/patienten/${patientId}#zahl`
            : "/finanzen";
    const handleCancel = () => {
        if (isFinanzenEmbed && onFinanzenClose) onFinanzenClose();
        else navigate(backTarget);
    };
    const hasClinicalLines = behandlungen.length + untersuchungen.length > 0;
    const noLinks = !canListLines || !patientId || akteLoading || zahlLinkOptions.length <= 1;
    const disabledBehandNoOpen =
        linkKind === "behand" && zahlNeuMaxBetragEur != null && zahlNeuMaxBetragEur <= ZAHL_EUR_EPS;

    return (
        <div className={isFinanzenEmbed ? undefined : "zahlung-create-page praxis-workspace-page praxis-workspace-page--form animate-fade-in"}>
            {!isFinanzenEmbed ? (
                <WorkspacePageHeader
                    title={t("zahlung.create.title")}
                    back={{ onClick: () => navigate(backTarget), label: fromKasse ? t("zahlung.create.back_kasse") : t("zahlung.create.back_finanzen") }}
                />
            ) : null}

            {!canListLines ? (
                <Card>
                    <CardHeader
                        title={t("common.role_denied")}
                        subtitle={t("zahlung.create.denied_sub")}
                    />
                </Card>
            ) : (
                <ZahlFinanzenOrPageWrap
                    isFinanzen={isFinanzenEmbed}
                    embedVariant={variant === "kasse" ? "kasse" : "finanzen"}
                    onClose={handleCancel}
                >
                    <div className="zahlung-create-form">
                        {!isFinanzenEmbed ? (
                            <p className="bestellung-create-form__hint">
                                {t("zahlung.create.assignment_hint")}
                            </p>
                        ) : (
                            <p className="bestellung-create-form__hint">
                                {t("zahlung.create.embed_hint")}
                            </p>
                        )}
                        {formError ? (
                            <p className="zahlung-create-form__error" role="alert">{formError}</p>
                        ) : null}
                            <PatientComboField
                                id="zc-patient"
                                label={t("zahlung.create.patient_label")}
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
                                        {t("zahlung.create.history_title")}
                                    </div>
                                    <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--fg-3)" }}>
                                        {t("zahlung.create.history_hint")}
                                    </p>
                                    {zahlungenPatientSorted.length === 0 ? (
                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                            {t("zahlung.create.history_empty")}
                                        </p>
                                    ) : (
                                        <div className="zahl-hist-table-wrap">
                                            <table className="tbl tbl-zahl-hist">
                                                <colgroup>
                                                    <col className="zahl-hist-col-datum" />
                                                    <col className="zahl-hist-col-bezug" />
                                                    <col className="zahl-hist-col-betrag" />
                                                    <col className="zahl-hist-col-art" />
                                                    <col className="zahl-hist-col-status" />
                                                </colgroup>
                                                <thead>
                                                    <tr>
                                                        <th scope="col">{t("zahlung.create.history_col_date")}</th>
                                                        <th scope="col">{t("zahlung.create.history_col_ref")}</th>
                                                        <th scope="col" className="tbl-th-num">{t("zahlung.create.history_col_amount")}</th>
                                                        <th scope="col">{t("zahlung.create.history_col_art")}</th>
                                                        <th scope="col">{t("zahlung.create.history_col_status")}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {zahlungenPatientSorted.map((z) => {
                                                        const st = zahlStatusDisplay(z.status, t);
                                                        return (
                                                            <tr key={z.id}>
                                                                <td>{formatDate(z.created_at)}</td>
                                                                <td className="zahl-hist-td-bezug">{formatZahlungBezugLine(z, behandlungen, untersuchungen, t, tp)}</td>
                                                                <td className="tbl-td-num">{formatCurrency(z.betrag)}</td>
                                                                <td>{zahlungsartLabel(z.zahlungsart, t)}</td>
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
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>{t("zahlung.create.behand_loading")}</p>
                            ) : null}
                            {noLinks && patientId && !akteLoading && !hasClinicalLines ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    {t("zahlung.create.no_clinical_lines")}
                                </p>
                            ) : null}
                            {noLinks && patientId && !akteLoading && hasClinicalLines ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    {t("zahlung.create.no_open_links")}
                                </p>
                            ) : null}
                            <Select
                                id="zc-zahl-link"
                                label={t("zahlung.create.link_label")}
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
                                                        {t("zahlung.create.behand_cost_title")}
                                                    </div>
                                                    <div
                                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                                        style={{ fontSize: 14 }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("zahlung.create.cost_should")}</div>
                                                            <div style={{ fontWeight: 700 }}>{gesamt != null ? formatCurrency(gesamt) : t("common.em_dash")}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("zahlung.create.paid_so_far")}</div>
                                                            <div style={{ fontWeight: 600 }}>{formatCurrency(paidSum)}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("zahlung.create.open_now")}</div>
                                                            <div
                                                                style={{
                                                                    fontWeight: 700,
                                                                    color: openNow != null && openNow > 0 ? "var(--fg-1)" : "var(--fg-3)",
                                                                }}
                                                            >
                                                                {openNow != null ? formatCurrency(openNow) : t("common.em_dash")}
                                                            </div>
                                                        </div>
                                                        {add > 0 && openAfter != null ? (
                                                            <div>
                                                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                                                    {t("zahlung.create.open_after")}
                                                                </div>
                                                                <div style={{ fontWeight: 600 }}>{formatCurrency(openAfter)}</div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="form-label form-label--wide">
                                                        {t("zahlung.create.behand_history_title")}
                                                    </div>
                                                    {hist.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                            {hist.map((h) => {
                                                                const hs = zahlStatusDisplay(h.status, t);
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
                                                            {t("zahlung.create.behand_history_empty")}
                                                        </p>
                                                    )}
                                                </div>
                                                <div
                                                    className="row"
                                                    style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}
                                                >
                                                    <span style={{ fontSize: 13, color: "var(--fg-3)" }}>
                                                        {t("zahlung.create.preview_after_save")}
                                                    </span>
                                                    <Badge
                                                        variant={previewCase === "BEZAHLT"
                                                            ? "success"
                                                            : previewCase === "TEILBEZAHLT"
                                                            ? "warning"
                                                            : "default"}
                                                    >
                                                        {previewCase === "BEZAHLT"
                                                            ? t("zahlung.create.preview_balanced")
                                                            : previewCase === "TEILBEZAHLT"
                                                            ? t("zahlung.create.preview_still_open")
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
                                                        {t("zahlung.create.untersuch_title")}
                                                    </div>
                                                    <div
                                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                                        style={{ fontSize: 14 }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("zahlung.create.cost_should")}</div>
                                                            <div style={{ fontWeight: 600 }}>{t("common.em_dash")}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("zahlung.create.paid_sum")}</div>
                                                            <div style={{ fontWeight: 600 }}>{formatCurrency(paidU)}</div>
                                                        </div>
                                                    </div>
                                                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                                        {t("zahlung.create.untersuch_no_should_hint")}
                                                    </p>
                                                </div>
                                                <div>
                                                    <div className="form-label form-label--wide">
                                                        {t("zahlung.create.untersuch_history_title")}
                                                    </div>
                                                    {histU.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                            {histU.map((h) => {
                                                                const hu = zahlStatusDisplay(h.status, t);
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
                                                            {t("zahlung.create.untersuch_history_empty")}
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()
                            ) : null}
                            <div className="zahlung-create-form__grid zahlung-create-form__grid--2">
                                <div>
                                    <Input
                                        id="zc-betrag"
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        max={zahlNeuMaxBetragEur != null ? zahlNeuMaxBetragEur : undefined}
                                        label={t("zahlung.create.payment_amount_label")}
                                        value={betrag}
                                        onChange={(e) => setBetrag(e.target.value)}
                                        onBlur={(e) => {
                                            if (zahlNeuMaxBetragEur == null) return;
                                            const n = Number(String(e.target.value).replace(",", "."));
                                            if (!Number.isFinite(n) || n <= 0) return;
                                            if (n > zahlNeuMaxBetragEur + ZAHL_EUR_EPS) {
                                                setBetrag(String(roundMoney2(zahlNeuMaxBetragEur)));
                                                toast(
                                                    tp("zahlung.create.amount_max_toast", { amount: formatCurrency(zahlNeuMaxBetragEur) }),
                                                    "info",
                                                );
                                            }
                                        }}
                                    />
                                    {zahlNeuMaxBetragEur != null ? (
                                        <p className="bestellung-create-form__note">
                                            {tp("zahlung.create.amount_max_hint", { amount: formatCurrency(zahlNeuMaxBetragEur) })}
                                        </p>
                                    ) : null}
                                </div>
                                <Select
                                    id="zc-art"
                                    label={t("zahlung.create.payment_method")}
                                    value={zahlungsart}
                                    onChange={(e) => setZahlungsart(e.target.value as ZahlungsArt)}
                                    options={zahlungArtSelectOptions(t)}
                                />
                            </div>
                            <div>
                                <Textarea
                                    id="zc-beschr"
                                    label={t("zahlung.create.desc_label")}
                                    rows={2}
                                    value={beschreibung}
                                    onChange={(e) => setBeschreibung(e.target.value)}
                                />
                                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                    {t("zahlung.create.desc_hint")}
                                </p>
                            </div>
                            <div className="zahlung-create-form__actions">
                                {linkKind === "behand" && disabledBehandNoOpen ? (
                                    <span className="bestellung-create-form__note" style={{ flex: "1 1 200px", marginInlineEnd: "auto" }}>
                                        {t("zahlung.create.behand_no_open")}
                                    </span>
                                ) : null}
                                <Button type="button" variant="ghost" onClick={handleCancel} disabled={busy}>
                                    {t("common.cancel")}
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
                                    {t("zahlung.create.save_btn")}
                                </Button>
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

export function ZahlungKasseCreatePage() {
    return <ZahlungCreatePanelInner variant="kasse-page" />;
}
