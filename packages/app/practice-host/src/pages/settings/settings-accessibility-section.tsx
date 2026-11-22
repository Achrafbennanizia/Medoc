import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import {
    BIG_SCREEN_MIN,
    normalizeDisplayPreferences,
    TEXT_SCALE_NAMES,
    TEXT_SCALES,
    textScaleAvailable,
    type DisplayPreferences,
    type StartPage,
} from "@/lib/display-preferences";
import { useT, useTParams } from "@/lib/i18n";
import { SettingsSwitch } from "@/views/components/settings-switch";

type Props = {
    appearance: NonNullable<ClientSettingsV1["appearance"]> | undefined;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
};

const START_PAGES: StartPage[] = ["auto", "dashboard", "appointments", "patients", "tickets"];

/**
 * Settings → Appearance → Accessibility & comfort. Every change applies immediately (applyAppearanceFromSettings
 * runs on save) and is remembered on this device.
 */
export function SettingsAccessibilitySection({ appearance, onPersistClient }: Props) {
    const t = useT();
    const tp = useTParams();
    const prefs = normalizeDisplayPreferences(appearance?.display);
    // The size in effect on this display (a size saved on a big screen is capped on a laptop).
    const activeScale = [...TEXT_SCALES].reverse().find((s) => s <= prefs.textScale && textScaleAvailable(s)) ?? 1;
    const bigScreenSizes = TEXT_SCALES.every(textScaleAvailable);
    const patch = (next: Partial<DisplayPreferences>) =>
        onPersistClient((c) => {
            const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
            return mergeClientSettingsPatch(c, { appearance: { ...a, display: { ...normalizeDisplayPreferences(a.display), ...next } } });
        });

    const toggles: { key: keyof DisplayPreferences; title: string; detail: string }[] = [
        { key: "reduceMotion", title: "settings.a11y.reduce_motion", detail: "settings.a11y.reduce_motion_detail" },
        { key: "underlineLinks", title: "settings.a11y.underline_links", detail: "settings.a11y.underline_links_detail" },
        { key: "largeTargets", title: "settings.a11y.large_targets", detail: "settings.a11y.large_targets_detail" },
        { key: "readingSpacing", title: "settings.a11y.reading_spacing", detail: "settings.a11y.reading_spacing_detail" },
        { key: "colorBlindStatus", title: "settings.a11y.color_blind", detail: "settings.a11y.color_blind_detail" },
    ];

    return (
        <section className="settings-subcard" aria-labelledby="settings-a11y-title">
            <div className="card-head">
                <div>
                    <div className="card-title" id="settings-a11y-title">
                        {t("settings.a11y.title")}
                    </div>
                    <div className="card-sub">{t("settings.a11y.subtitle")}</div>
                </div>
            </div>

            <div className="settings-row">
                <div>
                    <b>{t("settings.a11y.text_size")}</b>
                    <div className="card-sub">{t("settings.a11y.text_size_detail")}</div>
                    {!bigScreenSizes ? (
                        <div className="card-sub">{tp("settings.a11y.text_size_big_screen_only", { width: BIG_SCREEN_MIN.width, height: BIG_SCREEN_MIN.height })}</div>
                    ) : null}
                </div>
                <div className="seg" role="radiogroup" aria-label={t("settings.a11y.text_size")}>
                    {TEXT_SCALES.map((s) => {
                        const available = textScaleAvailable(s);
                        return (
                            <button
                                key={s}
                                type="button"
                                role="radio"
                                aria-checked={activeScale === s}
                                aria-pressed={activeScale === s}
                                disabled={!available}
                                title={available ? `${Math.round(s * 100)} %` : tp("settings.a11y.text_size_big_screen_only", { width: BIG_SCREEN_MIN.width, height: BIG_SCREEN_MIN.height })}
                                onClick={() => patch({ textScale: s })}
                            >
                                {t(`settings.a11y.text_size.${TEXT_SCALE_NAMES[s]}`)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="settings-row">
                <div>
                    <b>{t("settings.a11y.high_contrast")}</b>
                    <div className="card-sub">{t("settings.a11y.high_contrast_detail")}</div>
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.a11y.high_contrast")}
                    checked={prefs.contrast === "high"}
                    onChange={() => patch({ contrast: prefs.contrast === "high" ? "standard" : "high" })}
                />
            </div>

            {toggles.map((row) => (
                <div className="settings-row" key={row.key}>
                    <div>
                        <b>{t(row.title)}</b>
                        <div className="card-sub">{t(row.detail)}</div>
                    </div>
                    <SettingsSwitch
                        ariaLabel={t(row.title)}
                        checked={prefs[row.key] === true}
                        onChange={() => patch({ [row.key]: !(prefs[row.key] === true) } as Partial<DisplayPreferences>)}
                    />
                </div>
            ))}

            <div className="settings-row">
                <div>
                    <b>{t("settings.a11y.start_page")}</b>
                    <div className="card-sub">{t("settings.a11y.start_page_detail")}</div>
                </div>
                <div className="seg" role="radiogroup" aria-label={t("settings.a11y.start_page")}>
                    {START_PAGES.map((p) => (
                        <button key={p} type="button" role="radio" aria-checked={prefs.startPage === p} aria-pressed={prefs.startPage === p} onClick={() => patch({ startPage: p })}>
                            {t(`settings.a11y.start_page.${p}`)}
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}
