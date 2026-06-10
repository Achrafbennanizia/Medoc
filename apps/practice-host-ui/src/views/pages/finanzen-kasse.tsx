import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listZahlungen } from "@/systems/practice-host/controllers/zahlung.controller";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { filterRezeptionKassenQueue } from "@/lib/tagesabschluss";
import { allowed, parseRole } from "@/lib/rbac";
import { errorMessage, formatCurrency, formatDateTime } from "@/lib/utils";
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

function zahlungsartLabel(art: string): string {
    const map: Record<string, string> = {
        BAR: "Bar",
        KARTE: "Karte",
        UEBERWEISUNG: "Überweisung",
        RECHNUNG: "Rechnung",
    };
    return map[art] ?? art;
}

/**
 * Rezeption-only Kassenübersicht: heute erfasste Zahlungen, die im Tagesabschluss noch nicht bestätigt sind.
 */
export function FinanzenKassePage() {
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

    if (loading) {
        return (
            <div className="finanzen-kasse-page praxis-workspace-page animate-fade-in">
                <WorkspacePageHeader title="Kasseneingänge" />
                <PageLoading label="Zahlungen werden geladen…" />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="finanzen-kasse-page praxis-workspace-page animate-fade-in">
                <WorkspacePageHeader title="Kasseneingänge" />
                <PageLoadError message={loadError} onRetry={() => void load()} />
            </div>
        );
    }

    return (
        <div className="finanzen-kasse-page praxis-workspace-page animate-fade-in">
            <WorkspacePageHeader
                title="Kasseneingänge"
                subtitle="Ihre heute erfassten Zahlungen, die noch nicht über den Tagesabschluss bestätigt wurden. Vollständige Finanzübersicht und Abschluss sind nur für die Praxisleitung sichtbar."
                actions={
                    canWriteZahlung ? (
                        <Button type="button" onClick={() => navigate("/finanzen/kasse/neu")}>
                            + Neue Zahlung
                        </Button>
                    ) : null
                }
            />

            <div className="finanzen-kasse-page__kpi card card-elevated">
                <div>
                    <div className="kpi-label-mini">Heute offen</div>
                    <div className="finanzen-kasse-page__kpi-value">{formatCurrency(heuteSum)}</div>
                    <div className="finanzen-kasse-page__kpi-meta">
                        {heuteOffen.length} Zahlung{heuteOffen.length === 1 ? "" : "en"} · Stichtag {heute}
                    </div>
                </div>
                <Badge variant="warning">Wartet auf Tagesabschluss</Badge>
            </div>

            <section className="finanzen-kasse-page__list card card-elevated tbl-data-card">
                <div className="card-head">
                    <div>
                        <div className="card-title">Heute erfasst</div>
                        <div className="card-sub">Noch nicht im Tagesabschluss bestätigt</div>
                    </div>
                </div>
                {heuteOffen.length === 0 ? (
                    <div className="finanzen-kasse-page__list-empty">
                        <EmptyState
                            title="Alles erfasst"
                            description="Keine offenen Kasseneingänge für heute — oder alle wurden bereits im Tagesabschluss bestätigt."
                            action={
                                canWriteZahlung
                                    ? {
                                          label: "+ Neue Zahlung",
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
                                    <th scope="col">Zeit</th>
                                    <th scope="col">Patient</th>
                                    <th scope="col">Art</th>
                                    <th scope="col" className="tbl-th-num">Betrag</th>
                                    <th scope="col">Status</th>
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
                                        <td className="kasse-td-art">{zahlungsartLabel(z.zahlungsart)}</td>
                                        <td className="tbl-td-num">{formatCurrency(z.betrag)}</td>
                                        <td className="kasse-td-status">
                                            <Badge variant="warning">Offen</Badge>
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
