import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
    type ColorSchemeId,
    type FontStackId,
} from "@/lib/client-settings";
import { ACCENT_LABELS, ACCENT_ORDER, accentColorCircle, type AccentId } from "@/lib/accent-preset";
import {
    FONT_STACK_LABELS,
    FONT_STACK_ORDER,
    FONT_STACK_PREVIEW_FAMILY,
} from "@/lib/font-stack-preset";
import type { Locale } from "@/lib/i18n";
import { accentHintKey, fontStackHintKey, useT, useTParams } from "@/lib/i18n";
import { LocaleSwitcher } from "@/views/components/locale-switcher";
import { DARK_SIDEBAR_SETTINGS_ENABLED } from "@/lib/settings-ui-flags";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { useToastStore } from "@/views/components/ui/toast-store";

type AppearancePrefs = NonNullable<ClientSettingsV1["appearance"]>;

export type SettingsAppearanceSectionProps = {
    appearance: AppearancePrefs;
    colorSchemePref: ColorSchemeId;
    resolvedTheme: "light" | "dark";
    fontStack: FontStackId;
    densityLabel: string;
    accentPresetId: AccentId;
    locale: Locale;
    onLocaleChange: (locale: Locale) => void;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
};

export function SettingsAppearanceSection({
    appearance,
    colorSchemePref,
    resolvedTheme,
    fontStack,
    densityLabel,
    accentPresetId,
    locale,
    onLocaleChange,
    onPersistClient,
}: SettingsAppearanceSectionProps) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();

    const colorSchemeHint =
        colorSchemePref === "system"
            ? t("settings.appearance.color_scheme.system")
            : colorSchemePref === "dark"
              ? t("settings.appearance.color_scheme.dark")
              : t("settings.appearance.color_scheme.light");

    const densityOptions = [
        { id: "cozy" as const, label: t("settings.density.comfortable") },
        { id: "compact" as const, label: t("settings.density.compact") },
        { id: "spacious" as const, label: t("settings.density.spacious") },
    ];

    return (
        <section className="settings-subcard settings-subcard--segment-safe">
            <div className="card-head">
                <div className="card-title">{t("settings.appearance.title")}</div>
            </div>
            <div className="settings-row settings-row--wrap">
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <b>{t("settings.appearance.color_scheme.label")}</b>
                    <div className="card-sub">{colorSchemeHint}</div>
                </div>
                <div className="settings-lang-seg" role="group" aria-label={t("settings.appearance.color_scheme.aria")}>
                    <button
                        type="button"
                        className={`settings-lang-seg__btn${colorSchemePref === "light" ? " is-active" : ""}`}
                        onClick={() =>
                            onPersistClient((c) => {
                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                return mergeClientSettingsPatch(c, { appearance: { ...a, colorScheme: "light" } });
                            })
                        }
                    >
                        {t("settings.appearance.theme.light")}
                    </button>
                    <button
                        type="button"
                        className={`settings-lang-seg__btn${colorSchemePref === "dark" ? " is-active" : ""}`}
                        onClick={() =>
                            onPersistClient((c) => {
                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                return mergeClientSettingsPatch(c, { appearance: { ...a, colorScheme: "dark" } });
                            })
                        }
                    >
                        {t("settings.appearance.theme.dark")}
                    </button>
                    <button
                        type="button"
                        className={`settings-lang-seg__btn${colorSchemePref === "system" ? " is-active" : ""}`}
                        onClick={() =>
                            onPersistClient((c) => {
                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                return mergeClientSettingsPatch(c, { appearance: { ...a, colorScheme: "system" } });
                            })
                        }
                    >
                        {t("settings.appearance.theme.system")}
                    </button>
                </div>
            </div>
            {DARK_SIDEBAR_SETTINGS_ENABLED ? (
                <div className="settings-row">
                    <div>
                        <b>{t("settings.appearance.dark_sidebar")}</b>
                        <div className="card-sub">
                            {resolvedTheme === "dark"
                                ? t("settings.appearance.dark_sidebar.forced")
                                : t("settings.appearance.dark_sidebar.optional")}
                        </div>
                    </div>
                    <SettingsSwitch
                        ariaLabel={t("settings.appearance.dark_sidebar.aria")}
                        disabled={resolvedTheme === "dark"}
                        checked={appearance.darkSidebar}
                        onChange={() =>
                            onPersistClient((c) => {
                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                return mergeClientSettingsPatch(c, { appearance: { ...a, darkSidebar: !a.darkSidebar } });
                            })
                        }
                    />
                </div>
            ) : null}
            <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                <div>
                    <b>{t("settings.appearance.font")}</b>
                    <div className="card-sub">{t(fontStackHintKey(fontStack))}</div>
                </div>
                <div className="settings-font-seg" role="group" aria-label={t("settings.appearance.font")} style={{ width: "100%", justifyContent: "stretch" }}>
                    {FONT_STACK_ORDER.map((id) => (
                        <button
                            key={id}
                            type="button"
                            className={`settings-font-seg__btn${fontStack === id ? " is-active" : ""}`}
                            style={{ flex: 1, fontFamily: FONT_STACK_PREVIEW_FAMILY[id] }}
                            aria-pressed={fontStack === id}
                            onClick={() => {
                                if (fontStack === id) return;
                                onPersistClient((c) => {
                                    const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                    return mergeClientSettingsPatch(c, { appearance: { ...a, fontStack: id } });
                                });
                                toast(tp("settings.appearance.toast.font", { label: FONT_STACK_LABELS[id] }), "success");
                            }}
                        >
                            <span className="settings-font-seg__label">{FONT_STACK_LABELS[id]}</span>
                            <span className="settings-font-seg__sample" aria-hidden>
                                {t("settings.appearance.font.sample")}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                <div>
                    <b>{t("settings.appearance.density")}</b>
                    <div className="card-sub">{tp("settings.appearance.density.current", { label: densityLabel })}</div>
                </div>
                <div className="settings-density-seg" role="group" aria-label={t("settings.appearance.density.aria")} style={{ width: "100%", justifyContent: "stretch" }}>
                    {densityOptions.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            className={`settings-density-seg__btn${appearance.density === opt.id ? " is-active" : ""}`}
                            style={{ flex: 1 }}
                            onClick={() => {
                                if (appearance.density === opt.id) return;
                                onPersistClient((c) => {
                                    const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                    return mergeClientSettingsPatch(c, { appearance: { ...a, density: opt.id } });
                                });
                                toast(tp("settings.appearance.toast.density", { label: opt.label }), "info");
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.appearance.language")}</b>
                    <div className="card-sub">{t("settings.appearance.language.ui")}</div>
                </div>
                <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
            </div>
            <div className="settings-row settings-row--wrap settings-row--accent">
                <div className="settings-row-clickable__label">
                    <b>{t("settings.appearance.accent")}</b>
                    <div className="settings-row-muted">
                        {tp("settings.appearance.accent.hint", { label: ACCENT_LABELS[accentPresetId] })}
                        {" · "}
                        {t(accentHintKey(accentPresetId))}
                    </div>
                </div>
                <div role="radiogroup" aria-label={t("settings.appearance.accent.aria")} className="settings-accent-inline">
                    {ACCENT_ORDER.map((id: AccentId) => (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={accentPresetId === id}
                            aria-label={`${ACCENT_LABELS[id]}: ${t(accentHintKey(id))}`}
                            title={t(accentHintKey(id))}
                            className={`settings-accent-inline__swatch${accentPresetId === id ? " is-selected" : ""}`}
                            style={{ background: accentColorCircle(id) }}
                            onClick={() => {
                                if (accentPresetId === id) return;
                                onPersistClient((c) => {
                                    const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                    return mergeClientSettingsPatch(c, { appearance: { ...a, accentPreset: id } });
                                });
                                toast(tp("settings.appearance.toast.accent", { label: ACCENT_LABELS[id] }), "success");
                            }}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
