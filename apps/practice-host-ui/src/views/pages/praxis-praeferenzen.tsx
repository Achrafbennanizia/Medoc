import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    DEFAULT_PRAXIS_PRAEFERENZEN,
    loadPraxisPraeferenzenFromKv,
    normalizeMonthCalendarPatientLoad,
    savePraxisPraeferenzen,
    type MonthCalendarPatientLoadPrefs,
    type PraxisPraeferenzen,
} from "@/lib/praxis-praeferenzen-storage";
import { errorMessage } from "@/lib/utils";
import { useRbac } from "@/lib/use-rbac";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { useT, useTParams } from "@/lib/i18n";

function MonthCalColorField({
    label,
    valueHex,
    onChangeHex,
    colorCatalog,
}: {
    label: string;
    valueHex: string;
    onChangeHex: (hex: string) => void;
    colorCatalog: { label: string; hex: string }[];
}) {
    const t = useT();
    const tp = useTParams();
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="input-label" style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-2)" }}>{label}</span>
            <div className="praxis-month-cal-color-catalog" role="group" aria-label={tp("common.colors_for", { label })}>
                {colorCatalog.map(({ label: catLabel, hex }) => (
                    <button
                        key={hex + catLabel}
                        type="button"
                        className="praxis-month-cal-swatch"
                        title={`${catLabel} (${hex})`}
                        aria-label={catLabel}
                        style={{ backgroundColor: hex }}
                        onClick={() => onChangeHex(hex)}
                    />
                ))}
            </div>
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label className="row" style={{ gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("common.custom_color")}</span>
                    <input
                        type="color"
                        value={valueHex}
                        onChange={(e) => onChangeHex(e.target.value)}
                        aria-label={tp("common.custom_color_aria", { label })}
                        style={{ width: 44, height: 36, padding: 0, border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer" }}
                    />
                </label>
                <code style={{ fontSize: 11, color: "var(--fg-3)" }}>{valueHex}</code>
            </div>
        </div>
    );
}

export function PraxisPraeferenzenPage() {
    const navigate = useNavigate();
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const { canWritePraxisplanung } = useRbac();
    const [prefs, setPrefs] = useState<PraxisPraeferenzen>(DEFAULT_PRAXIS_PRAEFERENZEN);
    const [hydrated, setHydrated] = useState(false);

    const colorCatalog = useMemo(
        () => [
            { label: t("page.praxis_praeferenzen.color.green"), hex: "#22C55E" },
            { label: t("page.praxis_praeferenzen.color.yellow"), hex: "#EAB308" },
            { label: t("page.praxis_praeferenzen.color.red"), hex: "#EF4444" },
            { label: t("page.praxis_praeferenzen.color.orange"), hex: "#F97316" },
            { label: t("page.praxis_praeferenzen.color.blue"), hex: "#3B82F6" },
            { label: t("page.praxis_praeferenzen.color.purple"), hex: "#A855F7" },
            { label: t("page.praxis_praeferenzen.color.pink"), hex: "#EC4899" },
            { label: t("page.praxis_praeferenzen.color.petrol"), hex: "#14B8A6" },
            { label: t("page.praxis_praeferenzen.color.slate"), hex: "#64748B" },
        ],
        [t],
    );

    useEffect(() => {
        void loadPraxisPraeferenzenFromKv()
            .then((v) => setPrefs(v))
            .catch(() => {
                /* keep defaults */
            })
            .finally(() => setHydrated(true));
    }, []);

    const save = async () => {
        if (!canWritePraxisplanung) return;
      try {
            const normalized: PraxisPraeferenzen = {
                ...prefs,
                monthCalendarPatientLoad: normalizeMonthCalendarPatientLoad(prefs.monthCalendarPatientLoad),
            };
            await savePraxisPraeferenzen(normalized);
            const next = await loadPraxisPraeferenzenFromKv();
            setPrefs(next);
            toast(t("page.praxis_praeferenzen.toast.saved"));
        } catch (e: unknown) {
            toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
        }
    };

    const patchMonthCalLoad = (patch: Partial<MonthCalendarPatientLoadPrefs>) => {
        setPrefs((p) => ({
            ...p,
            monthCalendarPatientLoad: normalizeMonthCalendarPatientLoad({
                ...p.monthCalendarPatientLoad,
                ...patch,
            }),
        }));
    };

    const ml = prefs.monthCalendarPatientLoad;

    if (!hydrated) {
        return (
            <div className="praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader titleLevel="h1" title={t("page.praxis_praeferenzen.title")} subtitle={t("page.praxis_praeferenzen.loading")} />
            </div>
        );
    }

    return (
        <div className="praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader titleLevel="h1" title={t("page.praxis_praeferenzen.title")} />

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>{t("page.praxis_praeferenzen.rules_title")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        id="pref-puffer"
                        type="number"
                        min={0}
                        label={t("page.praxis_praeferenzen.field.puffer")}
                        value={prefs.pufferMin}
                        onChange={(e) => setPrefs((p) => ({ ...p, pufferMin: e.target.value }))}
                    />
                    <Input
                        id="pref-notfall"
                        type="number"
                        min={0}
                        label={t("page.praxis_praeferenzen.field.notfall")}
                        value={prefs.notfallPuffer}
                        onChange={(e) => setPrefs((p) => ({ ...p, notfallPuffer: e.target.value }))}
                    />
                    <Select
                        label={t("page.praxis_praeferenzen.reminder.label")}
                        value={prefs.reminder}
                        options={[
                            { value: "0", label: t("page.praxis_praeferenzen.reminder.0") },
                            { value: "2", label: t("page.praxis_praeferenzen.reminder.2") },
                            { value: "24", label: t("page.praxis_praeferenzen.reminder.24") },
                            { value: "48", label: t("page.praxis_praeferenzen.reminder.48") },
                        ]}
                        onChange={(e) => setPrefs((p) => ({ ...p, reminder: e.target.value }))}
                    />
                    <Select
                        label={t("page.praxis_praeferenzen.no_show.label")}
                        value={prefs.noShow}
                        options={[
                            { value: "warn", label: t("page.praxis_praeferenzen.no_show.warn") },
                            { value: "fee", label: t("page.praxis_praeferenzen.no_show.fee") },
                            { value: "block", label: t("page.praxis_praeferenzen.no_show.block") },
                        ]}
                        onChange={(e) => setPrefs((p) => ({ ...p, noShow: e.target.value }))}
                    />
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>{t("page.praxis_praeferenzen.month_cal_title")}</h2>
                <p className="page-sub" style={{ marginTop: -6, marginBottom: 16, maxWidth: 52 * 16 }}>
                    {t("page.praxis_praeferenzen.month_cal_intro")}
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Input
                            id="pref-month-few-max"
                            type="number"
                            min={0}
                            label={t("page.praxis_praeferenzen.field.few_max")}
                            value={String(ml.fewMax)}
                            onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                patchMonthCalLoad({
                                    fewMax: Number.isFinite(n) ? Math.max(0, n) : ml.fewMax,
                                });
                            }}
                        />
                        <Input
                            id="pref-month-medium-max"
                            type="number"
                            min={1}
                            label={t("page.praxis_praeferenzen.field.medium_max")}
                            value={String(ml.mediumMax)}
                            onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                patchMonthCalLoad({
                                    mediumMax: Number.isFinite(n) ? Math.max(0, n) : ml.mediumMax,
                                });
                            }}
                        />
                        <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                            {tp("page.praxis_praeferenzen.high_hint", { count: ml.mediumMax })}
                        </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <MonthCalColorField
                            label={t("page.praxis_praeferenzen.color.few")}
                            valueHex={ml.colorFew}
                            onChangeHex={(hex) => patchMonthCalLoad({ colorFew: hex })}
                            colorCatalog={colorCatalog}
                        />
                        <MonthCalColorField
                            label={t("page.praxis_praeferenzen.color.medium")}
                            valueHex={ml.colorMedium}
                            onChangeHex={(hex) => patchMonthCalLoad({ colorMedium: hex })}
                            colorCatalog={colorCatalog}
                        />
                        <MonthCalColorField
                            label={t("page.praxis_praeferenzen.color.high")}
                            valueHex={ml.colorHigh}
                            onChangeHex={(hex) => patchMonthCalLoad({ colorHigh: hex })}
                            colorCatalog={colorCatalog}
                        />
                    </div>
                </div>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/praxisplanung")}>{t("common.back")}</Button>
                {canWritePraxisplanung ? (
                    <Button type="button" onClick={save}>{t("common.save")}</Button>
                ) : null}
            </div>
        </div>
    );
}
