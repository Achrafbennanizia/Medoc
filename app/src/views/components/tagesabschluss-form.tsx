import { useCallback, useEffect, useMemo, useState } from "react";
import { listZahlungen, setZahlungenKasseGeprueft } from "@/controllers/zahlung.controller";
import type { CreateTagesabschlussProtokoll } from "@/controllers/tagesabschluss-protokoll.controller";
import { errorMessage, formatCurrency } from "@/lib/utils";
import {
    AMOUNT_TOL,
    amountsMatch,
    filterZahlungenForLocalDay,
    parseEuroInput,
    sumBarTag,
    sumEinnahmenTag,
} from "@/lib/tagesabschluss";
import type { Zahlung } from "@/models/types";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";
import { useToastStore } from "./ui/toast-store";

function stichtagDefault(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export type TagesabschlussProtokollExtra = {
    /** PDF-Tagesbericht: alle relevanten B-/U-Leistungen des Stichtags (gesamt), FA-FIN-INVOICE-Layout. */
    tagesberichtPdf: boolean;
};

export type TagesabschlussFormProps = {
    canWrite: boolean;
    getPatientName: (patientId: string) => string;
    onProtokolliere: (data: CreateTagesabschlussProtokoll, extra: TagesabschlussProtokollExtra) => Promise<void>;
    /** Wenn gesetzt, Stichtag fix (nur Anzeige). */
    fixedStichtag?: string;
    onCancel?: () => void;
    showCancelButton?: boolean;
    /** Während create läuft (Seite) */
    saveBusy?: boolean;
};

export function TagesabschlussForm({
    canWrite,
    getPatientName,
    onProtokolliere,
    fixedStichtag,
    onCancel,
    showCancelButton,
    saveBusy = false,
}: TagesabschlussFormProps) {
    const toast = useToastStore((s) => s.add);
    const [stichtag, setStichtag] = useState(fixedStichtag ?? stichtagDefault);
    const [gezaehltRaw, setGezaehltRaw] = useState("");
    const [notiz, setNotiz] = useState("");
    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [markBusy, setMarkBusy] = useState(false);
    const [tagesberichtPdf, setTagesberichtPdf] = useState(false);

    const load = useCallback(async () => {
        setLoadStatus("loading");
        setLoadError(null);
        try {
            setZahlungen(await listZahlungen());
            setLoadStatus("idle");
        } catch (e) {
            setLoadError(errorMessage(e));
            setLoadStatus("error");
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (fixedStichtag) setStichtag(fixedStichtag);
    }, [fixedStichtag]);

    const ymd = fixedStichtag ?? stichtag;
    const onDay = useMemo(() => filterZahlungenForLocalDay(zahlungen, ymd), [zahlungen, ymd]);
    const barLautSystem = useMemo(() => sumBarTag(zahlungen, ymd), [zahlungen, ymd]);
    const einnahmenLautSystem = useMemo(() => sumEinnahmenTag(zahlungen, ymd), [zahlungen, ymd]);

    const gezaehlt = useMemo(() => parseEuroInput(gezaehltRaw), [gezaehltRaw]);
    const showCompare = gezaehlt != null;
    const barMatch = showCompare && amountsMatch(gezaehlt!, barLautSystem);
    const barDelta = showCompare ? gezaehlt! - barLautSystem : 0;

    const idsZumSchnellMarkieren = useMemo(
        () => onDay.filter((z) => z.status !== "STORNIERT" && (z.status === "BEZAHLT" || z.status === "TEILBEZAHLT")).map((z) => z.id),
        [onDay],
    );
    const alleBereitsGeprueft =
        idsZumSchnellMarkieren.length > 0 &&
        idsZumSchnellMarkieren.every((id) => {
            const z = onDay.find((x) => x.id === id);
            return (z?.kasse_geprueft ?? 0) === 1;
        });

    const anzahlKasseGeprueft = useMemo(
        () => idsZumSchnellMarkieren.filter((id) => (onDay.find((x) => x.id === id)?.kasse_geprueft ?? 0) === 1).length,
        [idsZumSchnellMarkieren, onDay],
    );

    const schnellOptionSichtbar = canWrite && idsZumSchnellMarkieren.length > 0;

    const markiereAlle = async () => {
        if (!canWrite || idsZumSchnellMarkieren.length === 0) return;
        setMarkBusy(true);
        try {
            await setZahlungenKasseGeprueft(idsZumSchnellMarkieren, true);
            await load();
            toast(`${idsZumSchnellMarkieren.length} Zahlung${idsZumSchnellMarkieren.length === 1 ? "" : "en"} als kassengeprüft markiert.`, "success");
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setMarkBusy(false);
        }
    };

    const buildPayload = (): CreateTagesabschlussProtokoll => ({
        stichtag: ymd,
        gezaehlt_eur: gezaehlt,
        bar_laut_system_eur: barLautSystem,
        einnahmen_laut_system_eur: einnahmenLautSystem,
        abweichung_eur: showCompare ? barDelta : null,
        bar_stimmt: showCompare && barMatch ? 1 : 0,
        anzahl_zahlungen_tag: idsZumSchnellMarkieren.length,
        anzahl_kasse_geprueft: anzahlKasseGeprueft,
        alle_zahlungen_geprueft: idsZumSchnellMarkieren.length === 0 || alleBereitsGeprueft ? 1 : 0,
        notiz: notiz.trim() || null,
    });

    const protokoll = async () => {
        try {
            await onProtokolliere(buildPayload(), {
                tagesberichtPdf,
            });
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {loadStatus === "loading" ? (
                <p className="page-sub" style={{ margin: 0 }}>Zahlungen werden geladen…</p>
            ) : null}
            {loadStatus === "error" && loadError ? (
                <p style={{ color: "var(--danger, #c00)", margin: "0 0 12px" }} role="alert">
                    {loadError}
                </p>
            ) : null}

            <Input
                id="ts-stichtag"
                type="date"
                label="Stichtag (Kalendertag)"
                value={stichtag}
                disabled={Boolean(fixedStichtag)}
                onChange={(e) => {
                    setStichtag(e.target.value);
                }}
            />

            <div className="card card-pad" style={{ background: "var(--surface-1)", borderColor: "var(--border-2)" }}>
                <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>Bargeld laut Erfassung (System)</p>
                <p style={{ margin: 0, fontSize: 15, color: "var(--fg-2)" }}>
                    Summe der Barzahlungen (nicht storniert) für den Stichtag:{" "}
                    <strong style={{ color: "var(--fg-1)" }}>{formatCurrency(barLautSystem)}</strong>
                </p>
                <p className="page-sub" style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45 }}>
                    Referenz — alle Einnahmen des Tages (bar, Karte, …, verbucht, nicht storniert):{" "}
                    {formatCurrency(einnahmenLautSystem)}
                </p>
            </div>

            <Input
                id="ts-gezaehlt"
                label="Gezählter Bargeldbetrag (Kasse) — EUR"
                placeholder="z. B. 245,50"
                value={gezaehltRaw}
                onChange={(e) => setGezaehltRaw(e.target.value)}
            />

            {showCompare ? (
                <div
                    className="card card-pad"
                    style={{
                        borderColor: barMatch ? "var(--accent, #0a6)" : "var(--border-2)",
                        background: barMatch ? "var(--success-soft, rgba(0, 120, 80, 0.12))" : "var(--warning-soft, rgba(180, 120, 0, 0.1))",
                    }}
                >
                    {barMatch ? (
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--fg-1)" }}>
                            Die gezählte Kasse stimmt mit dem erfassten Bargeld überein.
                        </p>
                    ) : (
                        <p style={{ margin: 0, fontSize: 15, color: "var(--fg-1)" }}>
                            <strong>Abweichung:</strong>{" "}
                            {barDelta > 0
                                ? `${formatCurrency(barDelta)} mehr in der Kasse als im System.`
                                : `${formatCurrency(-barDelta)} weniger in der Kasse als im System.`}
                        </p>
                    )}
                </div>
            ) : (
                <p className="page-sub" style={{ margin: 0, fontSize: 13 }}>
                    Gezählten Bargeldbetrag eingeben, um den Abgleich mit der erfassten Bar-Summe anzuzeigen.
                </p>
            )}

            {schnellOptionSichtbar ? (
                <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p className="text-title" style={{ margin: 0, fontSize: 14 }}>Kassenprüfung der Tageszahlungen</p>
                    <p className="page-sub" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
                        Wenn alles stimmig ist, können Sie alle Zahlungen dieses Tages in einem Schritt als kassengeprüft markieren.
                    </p>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void markiereAlle()}
                            disabled={markBusy || alleBereitsGeprueft}
                            loading={markBusy}
                        >
                            {alleBereitsGeprueft
                                ? "Alle Tageszahlungen bereits geprüft"
                                : `Alle ${idsZumSchnellMarkieren.length} Tageszahlungen kassengeprüft markieren`}
                        </Button>
                    </div>
                </div>
            ) : null}

            <Textarea
                id="ts-notiz"
                label="Bemerkung (optional, wird im Protokoll gespeichert)"
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                rows={2}
            />

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-1)", borderColor: "var(--border-2)" }}>
                <p className="text-title" style={{ margin: 0, fontSize: 14 }}>Option: Tagesbericht (PDF)</p>
                <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                    Berichts-PDF: <strong>Sammelbeleg</strong> zum Stichtag — Leistungen und Beträge gruppiert{" "}
                    <strong>pro Patient</strong> (im PDF mit „Patient: …“ je Block). Das Dokument ist{" "}
                    <strong>nicht</strong> als persönliche Rechnung an eine Einzelperson adressiert, sondern als
                    Tagesübersicht für Buchhaltung/Abgleich. Gleiche Druck-Pipeline wie{" "}
                    <strong>Rechnung (PDF) / FA-FIN-INVOICE</strong>.
                </p>
                <label className="row" style={{ gap: 10, alignItems: "center", fontSize: 14, color: "var(--fg-2)" }}>
                    <input
                        type="checkbox"
                        checked={tagesberichtPdf}
                        onChange={(e) => {
                            setTagesberichtPdf(e.target.checked);
                        }}
                    />
                    Nach Protokoll Tagesbericht (PDF) erzeugen
                </label>
            </div>

            <div>
                <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>Zahlungen am Stichtag</p>
                {onDay.length === 0 ? (
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
                                {onDay.map((z) => (
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

            <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                Tagesabschluss speichert den Abgleich (Stichtag, Beträge, Kennzahlen) und optional Ihre Bemerkung. Toleranz
                Abgleich: ±
                {AMOUNT_TOL}
                {" "}
                €.
            </p>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                {showCancelButton && onCancel ? (
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={saveBusy}>
                        Abbrechen
                    </Button>
                ) : null}
                <Button
                    type="button"
                    onClick={() => void protokoll()}
                    disabled={!canWrite || saveBusy}
                    loading={saveBusy}
                >
                    Tagesabschluss protokollieren
                </Button>
            </div>
        </div>
    );
}
