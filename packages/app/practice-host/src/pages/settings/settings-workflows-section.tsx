import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from "react";
import {
    coverageRatio,
    loadOnboardingProgress,
    resetOnboardingProgress,
    stepsForRole,
} from "@/lib/onboarding";
import { ONBOARDING_COACHMARK_ENABLED } from "@/lib/v1-ui-flags";
import { parseRole } from "@/lib/rbac";
import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
    type AppointmentCalendarView,
} from "@/lib/client-settings";
import {
    CONFIRMATION_AREA_KEYS,
    resolveConfirmationPresentation,
    type AreaOverride,
    type ConfirmationAreaKey,
    type ConfirmationPrefs,
} from "@/lib/confirmation-preferences";
import { errorMessage } from "@/lib/utils";
import { persistAutocompleteSuggestionsToPracticeKv } from "@/lib/practice-search-prefs-sync";
import {
    CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED,
    WORKFLOW_CHART_CONFIRMATION_PREFS_UI_ENABLED,
    WORKFLOW_ONBOARDING_PREFS_UI_ENABLED,
} from "@/lib/settings-ui-flags";
import type { PracticePreferences } from "@/lib/practice-preferences-storage";
import { useUiPreferencesStore } from "@/models/store/ui-preferences-store";
import { Button } from "@/views/components/ui/button";
import { Input, Select } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useRbac } from "@/lib/use-rbac";
import { useT, useTParams } from "@/lib/i18n";

type WorkflowPrefs = NonNullable<ClientSettingsV1["workflows"]>;
type SearchPrefs = NonNullable<ClientSettingsV1["search"]>;

const AREA_OVERRIDE_OPTIONS = (t: (key: string) => string): readonly { value: AreaOverride; label: string }[] => [
    { value: "inherit", label: t("settings.workflows.override_inherit") },
    { value: "modal", label: t("settings.workflows.override_modal") },
    { value: "inline", label: t("settings.workflows.override_inline") },
];

function modeDisplayLabel(prefs: ConfirmationPrefs, key: ConfirmationAreaKey, t: (key: string) => string): string {
    const o = prefs.areas[key];
    const resolved = resolveConfirmationPresentation(prefs, key);
    if (o == null || o === "inherit") {
        return resolved === "modal" ? t("settings.workflows.confirm_standard_modal") : t("settings.workflows.confirm_standard_inline");
    }
    return o === "modal" ? t("settings.workflows.confirm_modal") : t("settings.workflows.confirm_inline");
}

function confirmationAreaLabel(key: ConfirmationAreaKey, t: (key: string) => string): string {
    return t(`settings.workflows.confirm_area.${key}`);
}

export type SettingsWorkflowsSectionProps = {
    prefs: PracticePreferences;
    prefsDirty: boolean;
    onPrefsChange: Dispatch<SetStateAction<PracticePreferences>>;
    onPrefsDirty: () => void;
    onSavePrefs: () => void | Promise<void>;
    workflows: WorkflowPrefs;
    searchPrefs: SearchPrefs;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
    role?: string;
};

export function SettingsWorkflowsSection({
    prefs,
    prefsDirty,
    onPrefsChange,
    onPrefsDirty,
    onSavePrefs,
    workflows: wf,
    searchPrefs,
    onPersistClient,
    role: roleRaw,
}: SettingsWorkflowsSectionProps) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const { canOpsSystem } = useRbac();
    const role = parseRole(roleRaw);
    const [onboardingPct, setOnboardingPct] = useState<number | null>(null);

    const refreshOnboardingPct = useCallback(async () => {
        if (!role) {
            setOnboardingPct(null);
            return;
        }
        try {
            const p = await loadOnboardingProgress(role);
            setOnboardingPct(Math.round(coverageRatio(role, p.completedRoutes) * 100));
        } catch (e) {
            setOnboardingPct(null);
            toast(tp("onboarding.toast.load_failed", { error: errorMessage(e) }), "warning");
        }
    }, [role, toast]);

    useEffect(() => {
        void refreshOnboardingPct();
    }, [refreshOnboardingPct]);
    const confirmations = useUiPreferencesStore((s) => s.confirmations);
    const hydratedUi = useUiPreferencesStore((s) => s.hydrated);
    const hydrateUiPrefs = useUiPreferencesStore((s) => s.hydrate);
    const setDefaultConfirmationMode = useUiPreferencesStore((s) => s.setDefaultConfirmationMode);
    const setAreaConfirmationOverride = useUiPreferencesStore((s) => s.setAreaConfirmationOverride);

    useEffect(() => {
        if (!hydratedUi) void hydrateUiPrefs();
    }, [hydratedUi, hydrateUiPrefs]);

    const persistConfirmationChange = async (action: () => Promise<void>, okMessage: string) => {
        try {
            await action();
            toast(okMessage, "success");
        } catch (e) {
            toast(tp("settings.workflows.persist_failed", { error: errorMessage(e) }), "error");
        }
    };

    return (
        <section className="settings-subcard settings-subcard--segment-safe">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.workflows.title")}</div>
                    <div className="card-sub">
                        {canOpsSystem ? t("settings.workflows.subtitle_ops") : t("settings.workflows.subtitle_user")}
                    </div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {canOpsSystem ? (
                <>
                <h3 className="text-title" style={{ margin: 0, fontSize: 15 }}>{t("settings.workflows.appointment_rules_title")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                        id="set-buffer"
                        type="number"
                        min={0}
                        label={t("settings.workflows.buffer")}
                        value={prefs.bufferMin}
                        onChange={(e) => {
                            onPrefsChange((p) => ({ ...p, bufferMin: e.target.value }));
                            onPrefsDirty();
                        }}
                    />
                    <Input
                        id="set-emergency"
                        type="number"
                        min={0}
                        label={t("settings.workflows.emergency_buffer")}
                        value={prefs.emergencyBuffer}
                        onChange={(e) => {
                            onPrefsChange((p) => ({ ...p, emergencyBuffer: e.target.value }));
                            onPrefsDirty();
                        }}
                    />
                    <Select
                        label={t("settings.workflows.reminder_label")}
                        value={prefs.reminder}
                        options={[
                            { value: "0", label: t("settings.workflows.reminder_0") },
                            { value: "2", label: t("settings.workflows.reminder_2h") },
                            { value: "24", label: t("settings.workflows.reminder_24h") },
                            { value: "48", label: t("settings.workflows.reminder_48h") },
                        ]}
                        onChange={(e) => {
                            onPrefsChange((p) => ({ ...p, reminder: e.target.value }));
                            onPrefsDirty();
                        }}
                    />
                    <Select
                        label={t("settings.workflows.noshow_label")}
                        value={prefs.noShow}
                        options={[
                            { value: "warn", label: t("settings.workflows.noshow_warn") },
                            { value: "fee", label: t("settings.workflows.noshow_fee") },
                            { value: "block", label: t("settings.workflows.noshow_block") },
                        ]}
                        onChange={(e) => {
                            onPrefsChange((p) => ({ ...p, noShow: e.target.value }));
                            onPrefsDirty();
                        }}
                    />
                </div>
                <label className="row" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                    <input
                        type="checkbox"
                        checked={prefs.calendarDragDropEnabled}
                        onChange={(e) => {
                            onPrefsChange((p) => ({ ...p, calendarDragDropEnabled: e.target.checked }));
                            onPrefsDirty();
                        }}
                        style={{ marginTop: 3 }}
                    />
                    <span>
                        <span className="text-title" style={{ display: "block", fontSize: 14 }}>
                            {t("settings.workflows.calendar_drag")}
                        </span>
                        <span className="card-sub" style={{ display: "block", marginTop: 4 }}>
                            {t("settings.workflows.calendar_drag_hint")}
                        </span>
                    </span>
                </label>
                <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                    <Button type="button" onClick={() => void onSavePrefs()} disabled={!prefsDirty}>
                        {t("common.save")}
                    </Button>
                </div>

                </>
                ) : null}

                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
                    <Select
                        label={t("settings.workflows.default_calendar_view")}
                        value={wf.appointmentsDefaultView ?? "month"}
                        onChange={(e) =>
                            onPersistClient((c) => {
                                const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                return mergeClientSettingsPatch(c, {
                                    workflows: { ...w, appointmentsDefaultView: e.target.value as AppointmentCalendarView },
                                });
                            })
                        }
                        options={[
                            { value: "day", label: t("settings.workflows.view_day") },
                            { value: "week", label: t("settings.workflows.view_week") },
                            { value: "month", label: t("settings.workflows.view_month") },
                        ]}
                    />
                    <p className="card-sub" style={{ margin: "8px 0 0" }}>
                        {t("settings.workflows.appointments_default_hint")}
                    </p>
                </div>

                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
                    <Select
                        label={t("settings.workflows.default_duration")}
                        value={String(wf.defaultAppointmentDurationMin ?? 30)}
                        onChange={(e) =>
                            onPersistClient((c) => {
                                const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                const n = Number.parseInt(e.target.value, 10);
                                return mergeClientSettingsPatch(c, {
                                    workflows: { ...w, defaultAppointmentDurationMin: Number.isFinite(n) ? n : 30 },
                                });
                            })
                        }
                        options={[
                            { value: "15", label: "15" },
                            { value: "20", label: "20" },
                            { value: "30", label: "30" },
                            { value: "45", label: "45" },
                            { value: "60", label: "60" },
                        ]}
                    />
                    <p className="card-sub" style={{ margin: "8px 0 0" }}>
                        {t("settings.workflows.default_duration_hint")}
                    </p>
                </div>

                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
                    <Input
                        id="ta-reminder"
                        label={t("settings.workflows.day_close_time")}
                        value={wf.dayCloseReminderTime ?? "18:00"}
                        onChange={(e) =>
                            onPersistClient((c) => {
                                const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                return mergeClientSettingsPatch(c, {
                                    workflows: { ...w, dayCloseReminderTime: e.target.value },
                                });
                            })
                        }
                        placeholder="18:00"
                    />
                    <p className="card-sub" style={{ margin: "8px 0 0" }}>
                        {t("settings.workflows.day_close_hint")}
                    </p>
                </div>

                <div className="settings-row" style={{ marginTop: 8 }}>
                    <div>
                        <b>{t("settings.workflows.search_insurance_title")}</b>
                        <div className="card-sub">{t("settings.workflows.search_insurance_hint")}</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={searchPrefs.patientIncludeInsuranceNumber !== false}
                        onChange={() =>
                            onPersistClient((c) => {
                                const s = c.search ?? DEFAULT_CLIENT_SETTINGS.search!;
                                const cur = s.patientIncludeInsuranceNumber !== false;
                                return mergeClientSettingsPatch(c, {
                                    search: { ...s, patientIncludeInsuranceNumber: !cur },
                                });
                            })
                        }
                        aria-label={t("settings.workflows.search_insurance_aria")}
                    />
                </div>

                {canOpsSystem ? (
                <div className="settings-row" style={{ marginTop: 10 }}>
                    <div>
                        <b>{t("settings.workflows.autocomplete_title")}</b>
                        <div className="card-sub">
                            {t("settings.workflows.autocomplete_hint")}
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={searchPrefs.autocompleteSuggestionsEnabled !== false}
                        onChange={() =>
                            onPersistClient((c) => {
                                const s = c.search ?? DEFAULT_CLIENT_SETTINGS.search!;
                                const cur = s.autocompleteSuggestionsEnabled !== false;
                                const next = !cur;
                                void persistAutocompleteSuggestionsToPracticeKv(next).catch((e) => {
                                    toast(
                                        tp("settings.workflows.autocomplete_save_failed", { error: errorMessage(e) }),
                                        "warning",
                                    );
                                });
                                return mergeClientSettingsPatch(c, {
                                    search: { ...s, autocompleteSuggestionsEnabled: next },
                                });
                            })
                        }
                        aria-label={t("settings.workflows.autocomplete_aria")}
                    />
                </div>
                ) : null}

                {role && ONBOARDING_COACHMARK_ENABLED && WORKFLOW_ONBOARDING_PREFS_UI_ENABLED ? (
                    <div className="settings-row" style={{ marginTop: 10 }}>
                        <div>
                            <b>{t("settings.workflows.onboarding_title")}</b>
                            <div className="card-sub">
                                {tp("settings.workflows.onboarding_hint", {
                                    steps: stepsForRole(role).length,
                                    role: role,
                                })}
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                                {onboardingPct == null ? t("common.dash") : tp("settings.workflows.onboarding_pct", { pct: onboardingPct })}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    void resetOnboardingProgress(role)
                                        .then(() => refreshOnboardingPct())
                                        .then(() => toast(t("settings.workflows.onboarding_reset_done"), "success"))
                                        .catch((e) =>
                                            toast(
                                                tp("settings.workflows.onboarding_reset_failed", { error: errorMessage(e) }),
                                                "error",
                                            ),
                                        )
                                }
                            >
                                {t("settings.workflows.onboarding_reset")}
                            </Button>
                        </div>
                    </div>
                ) : null}

                {CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED ? (
                <div className="settings-row" style={{ marginTop: 10 }}>
                    <div>
                        <b>{t("settings.workflows.emergency_toolbar_title")}</b>
                        <div className="card-sub">
                            {t("settings.workflows.emergency_toolbar_hint")}
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={wf.calendarEmergencyToolbarEnabled === true}
                        onChange={() =>
                            onPersistClient((c) => {
                                const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                const next = wf.calendarEmergencyToolbarEnabled !== true;
                                return mergeClientSettingsPatch(c, {
                                    workflows: { ...w, calendarEmergencyToolbarEnabled: next },
                                });
                            })
                        }
                        aria-label={t("settings.workflows.emergency_toolbar_aria")}
                    />
                </div>
                ) : null}

                {WORKFLOW_CHART_CONFIRMATION_PREFS_UI_ENABLED ? (
                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
                    <div className="card-head" style={{ paddingTop: 0, paddingInlineStart: 0, paddingInlineEnd: 0, borderBottom: "none" }}>
                        <div>
                            <div className="card-title">{t("settings.workflows.confirm_charts_title")}</div>
                            <div className="card-sub">{t("settings.workflows.confirm_charts_sub")}</div>
                        </div>
                    </div>
                    {!hydratedUi ? (
                        <p className="card-sub" style={{ margin: "0 0 12px" }}>{t("settings.workflows.confirm_loading")}</p>
                    ) : (
                        <>
                            <div className="settings-row" style={{ marginBottom: 10, borderTop: "none", paddingTop: 0 }}>
                                <div>
                                    <b>{t("settings.workflows.confirm_global")}</b>
                                    <div className="card-sub">{t("settings.workflows.confirm_global_hint")}</div>
                                </div>
                                <div className="seg" role="group" aria-label={t("settings.workflows.confirm_global_aria")}>
                                    <button
                                        type="button"
                                        aria-pressed={confirmations.defaultMode === "modal"}
                                        onClick={() =>
                                            void persistConfirmationChange(
                                                () => setDefaultConfirmationMode("modal"),
                                                t("settings.workflows.confirm_standard_modal"),
                                            )
                                        }
                                    >
                                        {t("settings.workflows.confirm_modal")}
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={confirmations.defaultMode === "inline"}
                                        onClick={() =>
                                            void persistConfirmationChange(
                                                () => setDefaultConfirmationMode("inline"),
                                                t("settings.workflows.confirm_standard_inline"),
                                            )
                                        }
                                    >
                                        {t("settings.workflows.confirm_inline")}
                                    </button>
                                </div>
                            </div>
                            <div className="tbl-scroll settings-confirm-table-wrap">
                                <table className="tbl tbl-settings-confirm" style={{ fontSize: 13 }}>
                                    <thead>
                                        <tr>
                                            <th scope="col">{t("settings.workflows.area")}</th>
                                            <th scope="col">{t("settings.workflows.confirm_current")}</th>
                                            <th scope="col" style={{ width: 180 }}>
                                                {t("settings.workflows.confirm_mode")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CONFIRMATION_AREA_KEYS.map((key: ConfirmationAreaKey) => {
                                            const override = confirmations.areas[key] ?? "inherit";
                                            const areaLabel = confirmationAreaLabel(key, t);
                                            return (
                                                <tr key={key}>
                                                    <td>{areaLabel}</td>
                                                    <td>{modeDisplayLabel(confirmations, key, t)}</td>
                                                    <td className="settings-confirm-select-cell">
                                                        <Select
                                                            id={`confirm-mode-${key}`}
                                                            className="settings-confirm-select min-w-0"
                                                            aria-label={tp("settings.workflows.confirm_area_aria", { area: areaLabel })}
                                                            value={override}
                                                            onChange={(e) =>
                                                                void persistConfirmationChange(
                                                                    () =>
                                                                        setAreaConfirmationOverride(
                                                                            key,
                                                                            e.target.value as AreaOverride,
                                                                        ),
                                                                    `${areaLabel}: ${
                                                                        e.target.value === "inherit"
                                                                            ? t("settings.workflows.override_inherit")
                                                                            : e.target.value === "modal"
                                                                              ? t("settings.workflows.confirm_modal")
                                                                              : t("settings.workflows.confirm_inline")
                                                                    }`,
                                                                )
                                                            }
                                                            options={[...AREA_OVERRIDE_OPTIONS(t)].map((o) => ({
                                                                value: o.value,
                                                                label:
                                                                    o.value === "inherit"
                                                                        ? tp("settings.workflows.override_standard", {
                                                                              mode:
                                                                                  confirmations.defaultMode === "modal"
                                                                                      ? t("settings.workflows.confirm_modal")
                                                                                      : t("settings.workflows.confirm_inline"),
                                                                          })
                                                                        : o.label,
                                                            }))}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
                ) : null}
            </div>
        </section>
    );
}
