import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listZahlungen } from "@/systems/practice-host/controllers/zahlung.controller";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { filterRezeptionKassenQueue } from "@/lib/tagesabschluss";
import { allowed, parseRole } from "@/lib/rbac";
import { errorMessage, formatCurrency, formatDateTime } from "@/lib/utils";
import { zahlungsartLabel } from "@/lib/finance-order-labels";
import { useLocale, useT, useTParams } from "@/lib/i18n";
import type { Patient, Zahlung } from "@/models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";

function todayYmd(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * Reception-only cash overview: payments recorded today not yet confirmed in Tagesabschluss.
 */
export function FinanzenKassePage() {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const role = session?.rolle ? parseRole(session.rolle) : null;
    const canWriteZahlung = role != null && allowed("finanzen.write", role);

    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const heute = todayYmd();

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [z, p] = await Promise.all([listZahlungen(), listPatienten()]);
            setZahlungen(z);
            setPatienten(p);
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const patientName = useCallback(
        (id: string) => patienten.find((p) => p.id === id)?.name ?? id,
        [patienten],
    );

    const heuteOffen = useMemo(
        () => filterRezeptionKassenQueue(zahlungen, heute).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        [zahlungen, heute],
    );

    const heuteSum = useMemo(() => heuteOffen.reduce((s, z) => s + z.betrag, 0), [heuteOffen]);

    const paymentPluralSuffix =
        heuteOffen.length === 1
            ? ""
            : locale === "de"
              ? "en"
              : locale === "fr"
                ? "s"
                : "s";

    if (loading) {
        return (
            <div className="finanzen-kasse-page praxis-workspace-page animate-fade-in">
                <WorkspacePageHeader title={t("page.finanzen_kasse.title")} />
                <PageLoading label={t("page.finanzen_kasse.loading")} />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="finanzen-kasse-page praxis-workspace-page animate-fade-in">
                <WorkspacePageHeader title={t("page.finanzen_kasse.title")} />
                <PageLoadError message={loadError} onRetry={() => void load()} />
            </div>
        );
    }

    return (
        <div className="finanzen-kasse-page praxis-workspace-page animate-fade-in">
            <WorkspacePageHeader
                title={t("page.finanzen_kasse.title")}
                subtitle={t("page.finanzen_kasse.subtitle")}
                actions={
                    canWriteZahlung ? (
                        <Button type="button" onClick={() => navigate("/finanzen/kasse/neu")}>
                            {t("page.finanzen_kasse.cta_new")}
                        </Button>
                    ) : null
                }
            />

            <div className="finanzen-kasse-page__kpi card card-elevated">
                <div>
                    <div className="kpi-label-mini">{t("page.finanzen_kasse.kpi_label")}</div>
                    <div className="finanzen-kasse-page__kpi-value">{formatCurrency(heuteSum)}</div>
                    <div className="finanzen-kasse-page__kpi-meta">
                        {tp("page.finanzen_kasse.kpi_meta", {
                            count: heuteOffen.length,
                            plural: paymentPluralSuffix,
                            date: heute,
                        })}
                    </div>
                </div>
                <Badge variant="warning">{t("page.finanzen_kasse.badge_pending")}</Badge>
            </div>

            <section className="finanzen-kasse-page__list card card-elevated tbl-data-card">
                <div className="card-head">
                    <div>
                        <div className="card-title">{t("page.finanzen_kasse.list_title")}</div>
                        <div className="card-sub">{t("page.finanzen_kasse.list_sub")}</div>
                    </div>
                </div>
                {heuteOffen.length === 0 ? (
                    <div className="finanzen-kasse-page__list-empty">
                        <EmptyState
                            title={t("page.finanzen_kasse.empty_title")}
                            description={t("page.finanzen_kasse.empty_desc")}
                            action={
                                canWriteZahlung
                                    ? {
                                          label: t("page.finanzen_kasse.cta_new"),
                                          onClick: () => navigate("/finanzen/kasse/neu"),
                                      }
                                    : undefined
                            }
                        />
                    </div>
                ) : (
                    <div className="finanzen-kasse-page__table-wrap tbl-scroll">
                        <table className="tbl tbl-kasse">
                            <colgroup>
                                <col className="kasse-col-zeit" />
                                <col className="kasse-col-patient" />
                                <col className="kasse-col-art" />
                                <col className="kasse-col-betrag" />
                                <col className="kasse-col-status" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th scope="col">{t("common.time")}</th>
                                    <th scope="col">{t("common.patient")}</th>
                                    <th scope="col">{t("drawer.finanzen_tx.kind_art")}</th>
                                    <th scope="col" className="tbl-th-num">
                                        {t("common.amount")}
                                    </th>
                                    <th scope="col">{t("common.status")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {heuteOffen.map((z) => (
                                    <tr key={z.id}>
                                        <td className="kasse-td-zeit">{formatDateTime(z.created_at)}</td>
                                        <td className="kasse-td-patient">
                                            <Link to={`/patienten/${z.patient_id}`} className="tbl-link">
                                                {patientName(z.patient_id)}
                                            </Link>
                                        </td>
                                        <td className="kasse-td-art">{zahlungsartLabel(z.zahlungsart, t)}</td>
                                        <td className="tbl-td-num">{formatCurrency(z.betrag)}</td>
                                        <td className="kasse-td-status">
                                            <Badge variant="warning">{t("page.finanzen_kasse.status_open")}</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
