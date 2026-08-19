import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    DEFAULT_PRACTICE_PREFERENCES,
    loadPracticePreferencesFromKv,
    normalizeMonthCalendarPatientLoad,
    savePracticePreferences,
    type MonthCalendarPatientLoadPrefs,
    type PracticePreferences,
} from "@/lib/practice-preferences-storage";
import { errorMessage } from "@/lib/utils";
import { useRbac } from "@/lib/use-rbac";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { AdministrationPageHeader } from "../components/administration-page-header";
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
            <div className="practice-month-cal-color-catalog" role="group" aria-label={tp("common.colors_for", { label })}>
                {colorCatalog.map(({ label: catLabel, hex }) => (
                    <button
                        key={hex + catLabel}
                        type="button"
                        className="practice-month-cal-swatch"
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

export function PracticePreferencesPage() {
    const navigate = useNavigate();
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const { canWritePracticePlanning } = useRbac();
    const [prefs, setPrefs] = useState<PracticePreferences>(DEFAULT_PRACTICE_PREFERENCES);
    const [hydrated, setHydrated] = useState(false);

    const colorCatalog = useMemo(
        () => [
            { label: t("page.practice_preferences.color.green"), hex: "#22C55E" },
            { label: t("page.practice_preferences.color.yellow"), hex: "#EAB308" },
            { label: t("page.practice_preferences.color.red"), hex: "#EF4444" },
            { label: t("page.practice_preferences.color.orange"), hex: "#F97316" },
            { label: t("page.practice_preferences.color.blue"), hex: "#3B82F6" },
            { label: t("page.practice_preferences.color.purple"), hex: "#A855F7" },
            { label: t("page.practice_preferences.color.pink"), hex: "#EC4899" },
            { label: t("page.practice_preferences.color.petrol"), hex: "#14B8A6" },
            { label: t("page.practice_preferences.color.slate"), hex: "#64748B" },
        ],
        [t],
    );

    useEffect(() => {
        void loadPracticePreferencesFromKv()
            .then((version) => setPrefs(version))
            .catch(() => {
                /* keep defaults */
            })
            .finally(() => setHydrated(true));
    }, []);

    const save = async () => {
        if (!canWritePracticePlanning) return;
      try {
            const normalized: PracticePreferences = {
                ...prefs,
                monthCalendarPatientLoad: normalizeMonthCalendarPatientLoad(prefs.monthCalendarPatientLoad),
            };
            await savePracticePreferences(normalized);
            const next = await loadPracticePreferencesFromKv();
            setPrefs(next);
            toast(t("page.practice_preferences.toast.saved"));
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
            <div className="practice-workspace-page animate-fade-in">
                <AdministrationPageHeader titleLevel="h1" title={t("page.practice_preferences.title")} subtitle={t("page.practice_preferences.loading")} />
            </div>
        );
    }

    return (
        <div className="practice-workspace-page animate-fade-in">
            <AdministrationPageHeader titleLevel="h1" title={t("page.practice_preferences.title")} />

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>{t("page.practice_preferences.rules_title")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        id="pref-buffer"
                        type="number"
                        min={0}
                        label={t("page.practice_preferences.field.buffer")}
                        value={prefs.bufferMin}
                        onChange={(e) => setPrefs((p) => ({ ...p, bufferMin: e.target.value }))}
                    />
                    <Input
                        id="pref-emergency"
                        type="number"
                        min={0}
                        label={t("page.practice_preferences.field.emergency")}
                        value={prefs.emergencyBuffer}
                        onChange={(e) => setPrefs((p) => ({ ...p, emergencyBuffer: e.target.value }))}
                    />
                    <Select
                        label={t("page.practice_preferences.reminder.label")}
                        value={prefs.reminder}
                        options={[
                            { value: "0", label: t("page.practice_preferences.reminder.0") },
                            { value: "2", label: t("page.practice_preferences.reminder.2") },
                            { value: "24", label: t("page.practice_preferences.reminder.24") },
                            { value: "48", label: t("page.practice_preferences.reminder.48") },
                        ]}
                        onChange={(e) => setPrefs((p) => ({ ...p, reminder: e.target.value }))}
                    />
                    <Select
                        label={t("page.practice_preferences.no_show.label")}
                        value={prefs.noShow}
                        options={[
                            { value: "warn", label: t("page.practice_preferences.no_show.warn") },
                            { value: "fee", label: t("page.practice_preferences.no_show.fee") },
                            { value: "block", label: t("page.practice_preferences.no_show.block") },
                        ]}
                        onChange={(e) => setPrefs((p) => ({ ...p, noShow: e.target.value }))}
                    />
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>{t("page.practice_preferences.month_cal_title")}</h2>
                <p className="page-sub" style={{ marginTop: -6, marginBottom: 16, maxWidth: 52 * 16 }}>
                    {t("page.practice_preferences.month_cal_intro")}
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Input
                            id="pref-month-few-max"
                            type="number"
                            min={0}
                            label={t("page.practice_preferences.field.few_max")}
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
                            label={t("page.practice_preferences.field.medium_max")}
                            value={String(ml.mediumMax)}
                            onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                patchMonthCalLoad({
                                    mediumMax: Number.isFinite(n) ? Math.max(0, n) : ml.mediumMax,
                                });
                            }}
                        />
                        <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                            {tp("page.practice_preferences.high_hint", { count: ml.mediumMax })}
                        </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <MonthCalColorField
                            label={t("page.practice_preferences.color.few")}
                            valueHex={ml.colorFew}
                            onChangeHex={(hex) => patchMonthCalLoad({ colorFew: hex })}
                            colorCatalog={colorCatalog}
                        />
                        <MonthCalColorField
                            label={t("page.practice_preferences.color.medium")}
                            valueHex={ml.colorMedium}
                            onChangeHex={(hex) => patchMonthCalLoad({ colorMedium: hex })}
                            colorCatalog={colorCatalog}
                        />
                        <MonthCalColorField
                            label={t("page.practice_preferences.color.high")}
                            valueHex={ml.colorHigh}
                            onChangeHex={(hex) => patchMonthCalLoad({ colorHigh: hex })}
                            colorCatalog={colorCatalog}
                        />
                    </div>
                </div>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <Button type="button" variant="secondary" onClick={() => navigate("/administration/practice-planning")}>{t("common.back")}</Button>
                {canWritePracticePlanning ? (
                    <Button type="button" onClick={save}>{t("common.save")}</Button>
                ) : null}
            </div>
        </div>
    );
}
