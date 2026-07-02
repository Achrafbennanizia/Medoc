import { useCallback, useEffect, useMemo, useState } from "react";
import type { TagesabschlussProtokollExtra } from "../components/tagesabschluss-form";
import { useNavigate } from "react-router-dom";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import {
    createTagesabschlussProtokoll,
    deleteTagesabschlussProtokoll,
    listTagesabschlussProtokolle,
    type CreateTagesabschlussProtokoll,
    type TagesabschlussProtokoll,
} from "@/systems/practice-host/controllers/tagesabschluss-protokoll.controller";
import { listZahlungen } from "@/systems/practice-host/controllers/zahlung.controller";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { zahlungLocalYmd } from "@/lib/tagesabschluss";
import { downloadTagesabschlussBerichtPdf } from "@/lib/tagesabschluss-invoice-pdf";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { Patient, Zahlung } from "@/models/types";
import { useLocale, useT, useTParams } from "@/lib/i18n";
import { TagesabschlussForm } from "../components/tagesabschluss-form";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";

/**
 * Tagesabschluss — list of logged closings + new run / detail (cash reconciliation).
 */
export function TagesabschlussPage() {
    const navigate = useNavigate();
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const timeLocale = locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-SA" : "en-US";
    const toast = useToastStore((s) => s.add);
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canRead = role != null && allowed("finanzen.read", role);
    const canWrite = role != null && allowed("finanzen.tagesabschluss.write", role);

    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [protokolle, setProtokolle] = useState<TagesabschlussProtokoll[]>([]);
    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<TagesabschlussProtokoll | null>(null);
    const [saveBusy, setSaveBusy] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const getPatientName = useCallback(
        (pid: string) => patienten.find((p) => p.id === pid)?.name ?? pid,
        [patienten],
    );

    const readField = useCallback(
        (label: string, value: string) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="kpi-label-mini">{label}</span>
                <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>{value || "—"}</span>
            </div>
        ),
        [],
    );

    const load = useCallback(
        async (initial?: boolean) => {
            if (initial) {
                setLoading(true);
                setLoadError(null);
            }
            try {
                const [pats, prots, zahls] = await Promise.all([listPatienten(), listTagesabschlussProtokolle(), listZahlungen()]);
                setPatienten(pats);
                setProtokolle(prots);
                setZahlungen(zahls);
                setSelected((cur) => {
                    if (!cur) return null;
                    return prots.find((x) => x.id === cur.id) ?? null;
                });
            } catch (e) {
                const msg = errorMessage(e);
                if (initial) setLoadError(msg);
                else toast(tp("common.refresh_failed", { message: msg }), "error");
            } finally {
                if (initial) setLoading(false);
            }
        },
        [toast, tp],
    );

    useEffect(() => {
        if (!canRead) return;
        void load(true);
    }, [load, canRead]);

    const onProtokolliere = async (data: CreateTagesabschlussProtokoll, extra: TagesabschlussProtokollExtra) => {
        if (!canWrite) return;
        setSaveBusy(true);
        try {
            const created = await createTagesabschlussProtokoll(data);
            toast(t("page.tagesabschluss.toast.saved"), "success");
            if (extra.tagesberichtPdf) {
                try {
                    await downloadTagesabschlussBerichtPdf(created, zahlungen, patienten);
                    toast(t("page.tagesabschluss.toast.pdf_ok"), "success");
                } catch (e) {
                    toast(tp("page.tagesabschluss.toast.pdf_fail", { message: errorMessage(e) }), "error");
                }
            }
            setCreating(false);
            void load();
            setSelected(created);
        } finally {
            setSaveBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const id = deleteId;
        try {
            await deleteTagesabschlussProtokoll(id);
            toast(t("page.tagesabschluss.toast.removed"), "success");
            setDeleteId(null);
            setSelected((s) => (s?.id === id ? null : s));
            void load();
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    };

    const handlePrintProtokoll = useCallback(() => {
        document.body.classList.add("tagesabschluss-printing");
        const clear = () => {
            document.body.classList.remove("tagesabschluss-printing");
        };
        window.addEventListener("afterprint", clear, { once: true });
        window.setTimeout(clear, 60_000);
        window.print();
    }, []);

    const openCreate = () => {
        setCreating(true);
        setSelected(null);
    };

    const zahlungenAmStichtag = useMemo(() => {
        if (!selected) return [] as Zahlung[];
        return zahlungen.filter((z) => zahlungLocalYmd(z.created_at) === selected.stichtag);
    }, [zahlungen, selected]);

    if (!canRead) {
        return (
            <div className="tagesabschluss-page praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader title={t("page.tagesabschluss.title")} subtitle={t("page.tagesabschluss.no_permission")} />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="tagesabschluss-page praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader title={t("page.tagesabschluss.title")} />
                <PageLoading label={t("page.tagesabschluss.loading")} />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="tagesabschluss-page praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader title={t("page.tagesabschluss.title")} />
                <PageLoadError message={loadError} onRetry={() => void load(true)} />
            </div>
        );
    }

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="produkte-detail-card tagesabschluss-read-print">
                    <CardHeader
                        title={t("page.tagesabschluss.new_title")}
                        subtitle={t("page.tagesabschluss.new_subtitle")}
                        action={(
                            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)} disabled={saveBusy} className="tagesabschluss-no-print">
                                {t("common.close")}
                            </Button>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0 }}>
                        <TagesabschlussForm
                            canWrite={canWrite}
                            getPatientName={getPatientName}
                            onProtokolliere={onProtokolliere}
                            onCancel={() => setCreating(false)}
                            showCancelButton
                            saveBusy={saveBusy}
                        />
                    </div>
                </Card>
            );
        }
        if (selected) {
            const barOk = selected.bar_stimmt === 1;
            const alleOk = selected.alle_zahlungen_geprueft === 1;
            return (
                <Card className="produkte-detail-card tagesabschluss-read-print">
                    <CardHeader
                        title={formatDate(selected.stichtag)}
                        subtitle={tp("page.tagesabschluss.detail.subtitle", { date: formatDateTime(selected.protokolliert_at) })}
                        action={(
                            <div className="row tagesabschluss-no-print" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                        void downloadTagesabschlussBerichtPdf(selected, zahlungen, patienten).catch((e) =>
                                            toast(tp("page.tagesabschluss.toast.pdf_fail", { message: errorMessage(e) }), "error"),
                                        )
                                    }
                                >
                                    {t("page.tagesabschluss.report_pdf")}
                                </Button>
                                <Button type="button" size="sm" variant="secondary" onClick={handlePrintProtokoll}>
                                    {t("page.tagesabschluss.print")}
                                </Button>
                                {canWrite ? (
                                    <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(selected.id)}>
                                        {t("page.tagesabschluss.remove_entry")}
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="produkte-read-grid">
                            {readField(t("page.tagesabschluss.field.stichtag"), formatDate(selected.stichtag))}
                            {readField(t("page.tagesabschluss.field.protokolliert"), formatDateTime(selected.protokolliert_at))}
                            {readField(t("page.tagesabschluss.field.bar_system"), formatCurrency(selected.bar_laut_system_eur))}
                            {readField(t("page.tagesabschluss.field.income_system"), formatCurrency(selected.einnahmen_laut_system_eur))}
                            {readField(t("page.tagesabschluss.field.counted"), selected.gezaehlt_eur == null ? "—" : formatCurrency(selected.gezaehlt_eur))}
                            {readField(t("page.tagesabschluss.field.deviation"), selected.abweichung_eur == null ? "—" : formatCurrency(selected.abweichung_eur))}
                            {readField(t("page.tagesabschluss.field.bar_match"), barOk ? t("page.tagesabschluss.bar_ok") : t("page.tagesabschluss.bar_match_bad"))}
                            {readField(
                                t("page.tagesabschluss.field.day_payments"),
                                tp("page.tagesabschluss.day_payments_detail", {
                                    total: selected.anzahl_zahlungen_tag,
                                    checked: selected.anzahl_kasse_geprueft,
                                    allOk: alleOk ? t("common.yes") : t("common.no"),
                                }),
                            )}
                        </div>
                        {selected.notiz ? readField(t("page.tagesabschluss.field.remark"), selected.notiz) : null}

                        <div>
                            <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>{t("page.tagesabschluss.payments_title")}</p>
                            <p className="page-sub" style={{ margin: "0 0 8px", fontSize: 12 }}>{t("page.tagesabschluss.payments_hint")}</p>
                            {zahlungenAmStichtag.length === 0 ? (
                                <p className="page-sub" style={{ margin: 0 }}>{t("page.tagesabschluss.no_payments")}</p>
                            ) : (
                                <div className="card" style={{ overflow: "auto", maxHeight: 220 }}>
                                    <table className="tbl" style={{ minWidth: 400, fontSize: 13, margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: "left" }}>{t("common.time")}</th>
                                                <th style={{ textAlign: "left" }}>{t("common.patient")}</th>
                                                <th>{t("page.tagesabschluss.col.art")}</th>
                                                <th>{t("common.status")}</th>
                                                <th style={{ textAlign: "end" }}>€</th>
                                                <th>{t("page.tagesabschluss.col.cash_checked")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {zahlungenAmStichtag.map((z) => (
                                                <tr key={z.id}>
                                                    <td>
                                                        {new Date(z.created_at.trim().replace(" ", "T")).toLocaleTimeString(timeLocale, {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </td>
                                                    <td style={{ maxWidth: 120 }} title={getPatientName(z.patient_id)}>
                                                        {getPatientName(z.patient_id).slice(0, 24)}
                                                    </td>
                                                    <td>{z.zahlungsart}</td>
                                                    <td>{z.status}</td>
                                                    <td style={{ textAlign: "end" }}>{formatCurrency(z.betrag)}</td>
                                                    <td style={{ textAlign: "center" }}>{(z.kasse_geprueft ?? 0) === 1 ? "✓" : "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="produkte-detail-card">
                <div className="card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                    <EmptyState
                        title={t("page.tagesabschluss.no_selection.title")}
                        description={t("page.tagesabschluss.no_selection.desc")}
                    />
                </div>
            </Card>
        );
    })();

    return (
        <div className="tagesabschluss-page praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                className="tagesabschluss-no-print"
                titleLevel="h1"
                title={t("page.tagesabschluss.title")}
                subtitle={
                    <>
                        {t("page.tagesabschluss.subtitle_part1")}{" "}
                        <strong>{t("breadcrumb.finance_reports")}</strong>{" "}
                        {t("page.tagesabschluss.subtitle_suffix")}{" "}
                        <button
                            type="button"
                            style={{ color: "var(--accent, #0a6)", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit" }}
                            onClick={() => navigate("/verwaltung/finanzen-berichte/rechnung")}
                        >
                            {t("breadcrumb.invoice_pdf")}
                        </button>
                        .
                    </>
                }
                actions={
                    canWrite ? (
                        <Button
                            type="button"
                            variant={creating ? "secondary" : "primary"}
                            onClick={creating ? () => setCreating(false) : openCreate}
                        >
                            {creating ? t("page.tagesabschluss.new_cancel_btn") : t("page.tagesabschluss.new_btn")}
                        </Button>
                    ) : null
                }
            />

            <div className="produkte-workspace">
                <div className="produkte-workspace__list tagesabschluss-protokoll-list">
                    {!canWrite ? (
                        <p className="page-sub" style={{ fontSize: 13, margin: "0 0 8px" }}>{t("page.tagesabschluss.write_hint")}</p>
                    ) : null}
                    <p className="text-title" style={{ margin: "0 0 8px", fontSize: 13 }}>{t("page.tagesabschluss.protocols")}</p>
                    {protokolle.length === 0 ? (
                        <p className="page-sub" style={{ margin: 0 }}>{t("page.tagesabschluss.empty_protocols")}</p>
                    ) : (
                        <div className="card" style={{ overflow: "auto" }}>
                            <table className="tbl" style={{ minWidth: 400, fontSize: 14, margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: "left" }}>{t("page.tagesabschluss.col.stichtag")}</th>
                                        <th style={{ textAlign: "left" }}>{t("page.tagesabschluss.col.protokolliert")}</th>
                                        <th style={{ textAlign: "end" }}>{t("page.tagesabschluss.col.bar_system")}</th>
                                        <th>{t("page.tagesabschluss.col.bar_match")}</th>
                                        <th>{t("page.tagesabschluss.col.day_payments")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {protokolle.map((row) => {
                                        const isSel = selected?.id === row.id && !creating;
                                        return (
                                            <tr
                                                key={row.id}
                                                className={isSel ? "produkte-row--selected" : undefined}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => {
                                                    setCreating(false);
                                                    setSelected(row);
                                                }}
                                            >
                                                <td>{formatDate(row.stichtag)}</td>
                                                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.protokolliert_at)}</td>
                                                <td style={{ textAlign: "end" }}>{formatCurrency(row.bar_laut_system_eur)}</td>
                                                <td>{row.bar_stimmt === 1 ? t("page.tagesabschluss.bar_ok") : t("page.tagesabschluss.bar_check")}</td>
                                                <td>
                                                    {row.anzahl_zahlungen_tag}
                                                    {" "}
                                                    /
                                                    {" "}
                                                    {row.anzahl_kasse_geprueft}
                                                    {" "}
                                                    {t("page.tagesabschluss.checked_short")}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="produkte-workspace__detail">{sidePanel}</div>
            </div>

            <ConfirmDialog
                open={deleteId != null}
                onClose={() => setDeleteId(null)}
                onConfirm={() => void handleDelete()}
                title={t("page.tagesabschluss.delete.title")}
                message={t("page.tagesabschluss.delete.message")}
                danger
            />
        </div>
    );
}
