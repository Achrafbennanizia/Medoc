import { useCallback, useEffect, useMemo, useState } from "react";
import type { TagesabschlussProtokollExtra } from "../components/tagesabschluss-form";
import { useNavigate } from "react-router-dom";
import { listPatienten } from "@/controllers/patient.controller";
import {
    createTagesabschlussProtokoll,
    deleteTagesabschlussProtokoll,
    listTagesabschlussProtokolle,
    type CreateTagesabschlussProtokoll,
    type TagesabschlussProtokoll,
} from "@/controllers/tagesabschluss-protokoll.controller";
import { listZahlungen } from "@/controllers/zahlung.controller";
import { errorMessage, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { zahlungLocalYmd } from "@/lib/tagesabschluss";
import { downloadTagesabschlussBerichtPdf } from "@/lib/tagesabschluss-invoice-pdf";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { Patient, Zahlung } from "@/models/types";
import { TagesabschlussForm } from "../components/tagesabschluss-form";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";

function readField(label: string, value: string) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>{value || "—"}</span>
        </div>
    );
}

/**
 * Tagesabschluss — Liste protokollierter Abschlüsse + neuer Lauf / Detail (Kassenabgleich).
 */
export function TagesabschlussPage() {
    const navigate = useNavigate();
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
                else toast(`Aktualisieren fehlgeschlagen: ${msg}`, "error");
            } finally {
                if (initial) setLoading(false);
            }
        },
        [toast],
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
            toast("Tagesabschluss protokolliert und gespeichert.", "success");
            if (extra.tagesberichtPdf) {
                try {
                    await downloadTagesabschlussBerichtPdf(created, zahlungen, patienten);
                    toast("Tagesbericht-PDF erzeugt (Sammelbeleg je Patient zum Stichtag, FA-FIN-INVOICE-Layout).", "success");
                } catch (e) {
                    toast(`Tagesbericht (PDF) fehlgeschlagen: ${errorMessage(e)}`, "error");
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
            toast("Protokolleintrag entfernt.", "success");
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
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <h2 className="page-title">Tagesabschluss</h2>
                <p className="page-sub" style={{ margin: 0 }}>Keine Berechtigung Finanzen (Lesen).</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <h2 className="page-title">Tagesabschluss</h2>
                <PageLoading label="Daten werden geladen…" />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <h2 className="page-title">Tagesabschluss</h2>
                <PageLoadError message={loadError} onRetry={() => void load(true)} />
            </div>
        );
    }

    const sidePanel = (() => {
        if (creating && canWrite) {
            return (
                <Card className="produkte-detail-card tagesabschluss-read-print">
                    <CardHeader
                        title="Neuer Tagesabschluss"
                        subtitle="Stichtag wählen, Kasse abgleichen, Kassenprüfung setzen, protokollieren — wie bei anderen Verwaltungslisten im rechten Panel."
                        action={(
                            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)} disabled={saveBusy} className="tagesabschluss-no-print">
                                Schließen
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
                        subtitle={`Protokolliert ${formatDateTime(selected.protokolliert_at)} — gespeicherte Kennzahlen zum Abgleich.`}
                        action={(
                            <div className="row tagesabschluss-no-print" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button type="button" size="sm" variant="secondary" onClick={handlePrintProtokoll}>
                                    Drucken
                                </Button>
                                {canWrite ? (
                                    <Button type="button" size="sm" variant="danger" onClick={() => setDeleteId(selected.id)}>
                                        Eintrag entfernen
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="produkte-read-grid">
                            {readField("Stichtag", formatDate(selected.stichtag))}
                            {readField("Protokolliert", formatDateTime(selected.protokolliert_at))}
                            {readField("Bargeld laut System (Snapshot)", formatCurrency(selected.bar_laut_system_eur))}
                            {readField("Einnahmen laut System (Snapshot)", formatCurrency(selected.einnahmen_laut_system_eur))}
                            {readField("Gezählt (Kasse)", selected.gezaehlt_eur == null ? "—" : formatCurrency(selected.gezaehlt_eur))}
                            {readField("Abweichung", selected.abweichung_eur == null ? "—" : formatCurrency(selected.abweichung_eur))}
                            {readField("Bargeld-Abgleich", barOk ? "Stimmig" : "Abweichung / nicht gewichtet")}
                            {readField("Tageszahlungen (Anzahl / geprüft / alle ok)", `${selected.anzahl_zahlungen_tag} / ${selected.anzahl_kasse_geprueft} / ${alleOk ? "ja" : "nein"}`)}
                        </div>
                        {selected.notiz ? readField("Bemerkung", selected.notiz) : null}

                        <div>
                            <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>Zahlungen am Stichtag (aktuell)</p>
                            <p className="page-sub" style={{ margin: "0 0 8px", fontSize: 12 }}>Live aus der Zahlungsliste — kann sich nach dem Protokoll ändern.</p>
                            {zahlungenAmStichtag.length === 0 ? (
                                <p className="page-sub" style={{ margin: 0 }}>Keine Zahlungen an diesem Tag.</p>
                            ) : (
                                <div className="card" style={{ overflow: "auto", maxHeight: 220 }}>
                                    <table className="tbl" style={{ minWidth: 400, fontSize: 13, margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: "left" }}>Zeit</th>
                                                <th style={{ textAlign: "left" }}>Patient</th>
                                                <th>Art</th>
                                                <th>Status</th>
                                                <th style={{ textAlign: "right" }}>€</th>
                                                <th>Kasse geprüft</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {zahlungenAmStichtag.map((z) => (
                                                <tr key={z.id}>
                                                    <td>
                                                        {new Date(z.created_at.trim().replace(" ", "T")).toLocaleTimeString("de-DE", {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </td>
                                                    <td style={{ maxWidth: 120 }} title={getPatientName(z.patient_id)}>
                                                        {getPatientName(z.patient_id).slice(0, 24)}
                                                    </td>
                                                    <td>{z.zahlungsart}</td>
                                                    <td>{z.status}</td>
                                                    <td style={{ textAlign: "right" }}>{formatCurrency(z.betrag)}</td>
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
                        title="Keine Auswahl"
                        description="Wählen Sie einen protokollierten Tag in der Liste oder starten Sie einen neuen Tagesabschluss."
                    />
                </div>
            </Card>
        );
    })();

    return (
        <div className="tagesabschluss-page animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="tagesabschluss-no-print">
                <VerwaltungBackButton />
            </div>
            <div className="page-head tagesabschluss-no-print" style={{ alignItems: "flex-start" }}>
                <div>
                    <h1 className="page-title" style={{ margin: 0 }}>Tagesabschluss</h1>
                    <p className="page-sub" style={{ maxWidth: 720, marginTop: 8 }}>
                        Teil von
                        {" "}
                        <strong>Finanzen &amp; Berichte</strong>
                        {" "}
                        — Kassenabgleich, Liste + Detail. Rechnung als PDF:
                        {" "}
                        <button
                            type="button"
                            style={{ color: "var(--accent, #0a6)", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit" }}
                            onClick={() => navigate("/verwaltung/finanzen-berichte/rechnung")}
                        >
                            Rechnung (PDF)
                        </button>
                        .
                    </p>
                </div>
                {canWrite ? (
                    <Button
                        type="button"
                        variant={creating ? "secondary" : "primary"}
                        onClick={creating ? () => setCreating(false) : openCreate}
                    >
                        {creating ? "Neuer Tagesabschluss abbrechen" : "+ Neuer Tagesabschluss"}
                    </Button>
                ) : null}
            </div>

            <div className="produkte-workspace">
                <div className="produkte-workspace__list tagesabschluss-protokoll-list">
                    {!canWrite ? (
                        <p className="page-sub" style={{ fontSize: 13, margin: "0 0 8px" }}>Nur mit Berechtigung Finanzen (Schreiben): neu protokollieren.</p>
                    ) : null}
                    <p className="text-title" style={{ margin: "0 0 8px", fontSize: 13 }}>Protokolle</p>
                    {protokolle.length === 0 ? (
                        <p className="page-sub" style={{ margin: 0 }}>Noch kein Tagesabschluss gespeichert — „Neuer Tagesabschluss“ nutzen.</p>
                    ) : (
                        <div className="card" style={{ overflow: "auto" }}>
                            <table className="tbl" style={{ minWidth: 400, fontSize: 14, margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: "left" }}>Stichtag</th>
                                        <th style={{ textAlign: "left" }}>Protokolliert</th>
                                        <th style={{ textAlign: "right" }}>Bar (System)</th>
                                        <th>Bar-Abgleich</th>
                                        <th>Tageszahlungen</th>
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
                                                <td style={{ textAlign: "right" }}>{formatCurrency(row.bar_laut_system_eur)}</td>
                                                <td>{row.bar_stimmt === 1 ? "Stimmig" : "Prüfen"}</td>
                                                <td>
                                                    {row.anzahl_zahlungen_tag}
                                                    {" "}
                                                    /
                                                    {" "}
                                                    {row.anzahl_kasse_geprueft}
                                                    {" "}
                                                    gepr.
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
                title="Protokolleintrag entfernen?"
                message="Nur der gespeicherte Abschlusseintrag wird gelöscht — Zahlungen in der Kasse bleiben unverändert."
                danger
            />
        </div>
    );
}
