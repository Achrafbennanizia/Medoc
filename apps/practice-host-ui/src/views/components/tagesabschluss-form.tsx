import { useCallback, useEffect, useMemo, useState } from "react";
import { listZahlungen, setZahlungenKasseGeprueft } from "@/systems/practice-host/controllers/zahlung.controller";
import type { CreateTagesabschlussProtokoll } from "@/systems/practice-host/controllers/tagesabschluss-protokoll.controller";
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
import { useLocale, useT, useTParams } from "@/lib/i18n";
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
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const timeLocale = locale === "de" ? "de-DE" : locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-SA" : "en-US";
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
            const count = idsZumSchnellMarkieren.length;
            toast(
                count === 1
                    ? tp("page.tagesabschluss.toast.marked_one", { count })
                    : tp("page.tagesabschluss.toast.marked_many", { count }),
                "success",
            );
        } catch (e) {
            toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
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
            toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {loadStatus === "loading" ? (
                <p className="page-sub" style={{ margin: 0 }}>{t("page.tagesabschluss.form.loading_payments")}</p>
            ) : null}
            {loadStatus === "error" && loadError ? (
                <p style={{ color: "var(--danger, #c00)", margin: "0 0 12px" }} role="alert">
                    {loadError}
                </p>
            ) : null}

            <Input
                id="ts-stichtag"
                type="date"
                label={t("page.tagesabschluss.form.stichtag_label")}
                value={stichtag}
                disabled={Boolean(fixedStichtag)}
                onChange={(e) => {
                    setStichtag(e.target.value);
                }}
            />

            <div className="card card-pad" style={{ background: "var(--surface-1)", borderColor: "var(--border-2)" }}>
                <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>{t("page.tagesabschluss.form.cash_system_title")}</p>
                <p style={{ margin: 0, fontSize: 15, color: "var(--fg-2)" }}>
                    {t("page.tagesabschluss.form.cash_system_desc")}{" "}
                    <strong style={{ color: "var(--fg-1)" }}>{formatCurrency(barLautSystem)}</strong>
                </p>
                <p className="page-sub" style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45 }}>
                    {t("page.tagesabschluss.form.cash_system_income_ref")}{" "}
                    {formatCurrency(einnahmenLautSystem)}
                </p>
            </div>

            <Input
                id="ts-gezaehlt"
                label={t("page.tagesabschluss.form.counted_label")}
                placeholder={t("page.tagesabschluss.form.counted_ph")}
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
                            {t("page.tagesabschluss.form.match_ok")}
                        </p>
                    ) : (
                        <p style={{ margin: 0, fontSize: 15, color: "var(--fg-1)" }}>
                            <strong>{t("page.tagesabschluss.form.deviation_label")}</strong>{" "}
                            {barDelta > 0
                                ? tp("page.tagesabschluss.form.deviation_more", { amount: formatCurrency(barDelta) })
                                : tp("page.tagesabschluss.form.deviation_less", { amount: formatCurrency(-barDelta) })}
                        </p>
                    )}
                </div>
            ) : (
                <p className="page-sub" style={{ margin: 0, fontSize: 13 }}>
                    {t("page.tagesabschluss.form.enter_count_hint")}
                </p>
            )}

            {schnellOptionSichtbar ? (
                <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p className="text-title" style={{ margin: 0, fontSize: 14 }}>{t("page.tagesabschluss.form.cash_check_title")}</p>
                    <p className="page-sub" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
                        {t("page.tagesabschluss.form.cash_check_desc")}
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
                                ? t("page.tagesabschluss.form.mark_all_done")
                                : tp("page.tagesabschluss.form.mark_all", { count: idsZumSchnellMarkieren.length })}
                        </Button>
                    </div>
                </div>
            ) : null}

            <Textarea
                id="ts-notiz"
                label={t("page.tagesabschluss.form.remark_label")}
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                rows={2}
            />

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface-1)", borderColor: "var(--border-2)" }}>
                <p className="text-title" style={{ margin: 0, fontSize: 14 }}>{t("page.tagesabschluss.form.pdf_option_title")}</p>
                <p className="page-sub" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
                    {t("page.tagesabschluss.form.pdf_option_desc")}
                </p>
                <label className="row" style={{ gap: 10, alignItems: "center", fontSize: 14, color: "var(--fg-2)" }}>
                    <input
                        type="checkbox"
                        checked={tagesberichtPdf}
                        onChange={(e) => {
                            setTagesberichtPdf(e.target.checked);
                        }}
                    />
                    {t("page.tagesabschluss.form.pdf_checkbox")}
                </label>
            </div>

            <div>
                <p className="text-title" style={{ margin: "0 0 8px", fontSize: 14 }}>{t("page.tagesabschluss.payments_title")}</p>
                {onDay.length === 0 ? (
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
                                    <th style={{ textAlign: "right" }}>€</th>
                                    <th>{t("page.tagesabschluss.col.cash_checked")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {onDay.map((z) => (
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
                {tp("page.tagesabschluss.form.footer_hint", { tolerance: AMOUNT_TOL })}
            </p>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                {showCancelButton && onCancel ? (
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={saveBusy}>
                        {t("common.cancel")}
                    </Button>
                ) : null}
                <Button
                    type="button"
                    onClick={() => void protokoll()}
                    disabled={!canWrite || saveBusy}
                    loading={saveBusy}
                >
                    {t("page.tagesabschluss.form.submit")}
                </Button>
            </div>
        </div>
    );
}
