import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
    type ColorSchemeId,
    type FontStackId,
} from "@/lib/client-settings";
import { ACCENT_HINTS, ACCENT_LABELS, ACCENT_ORDER, accentColorCircle, type AccentId } from "@/lib/accent-preset";
import type { Locale } from "@/lib/i18n";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { useToastStore } from "@/views/components/ui/toast-store";

type AppearancePrefs = NonNullable<ClientSettingsV1["appearance"]>;

export type EinstellungenDarstellungSectionProps = {
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

export function EinstellungenDarstellungSection({
    appearance,
    colorSchemePref,
    resolvedTheme,
    fontStack,
    densityLabel,
    accentPresetId,
    locale,
    onLocaleChange,
    onPersistClient,
}: EinstellungenDarstellungSectionProps) {
    const toast = useToastStore((s) => s.add);

    return (
        <section className="settings-subcard settings-subcard--segment-safe">
            <div className="card-head">
                <div className="card-title">Darstellung</div>
            </div>
            <div className="settings-row settings-row--wrap">
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <b>Erscheinungsbild</b>
                    <div className="card-sub">
                        {colorSchemePref === "system"
                            ? "Folgt Hell/Dunkel der Systemeinstellung"
                            : colorSchemePref === "dark"
                              ? "Dunkle Oberfläche in der gesamten App"
                              : "Helle Oberfläche"}
                    </div>
                </div>
                <div className="settings-lang-seg" role="group" aria-label="Erscheinungsbild">
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
                        Hell
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
                        Dunkel
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
                        System
                    </button>
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>Dunkle Seitenleiste</b>
                    <div className="card-sub">
                        {resolvedTheme === "dark"
                            ? "Bei dunklem Erscheinungsbild immer aktiv"
                            : "Nur die linke Navigation dunkel darstellen"}
                    </div>
                </div>
                <SettingsSwitch
                    ariaLabel="Dunkle Seitenleiste"
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
            <div className="settings-row settings-row--wrap">
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <b>Systemschrift</b>
                    <div className="card-sub">{fontStack === "system" ? "System · 14 pt" : "Inter · 14 pt"}</div>
                </div>
                <div className="settings-lang-seg" role="group" aria-label="Systemschrift">
                    <button
                        type="button"
                        className={`settings-lang-seg__btn${fontStack === "inter" ? " is-active" : ""}`}
                        onClick={() => {
                            if (fontStack === "inter") return;
                            onPersistClient((c) => {
                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                return mergeClientSettingsPatch(c, { appearance: { ...a, fontStack: "inter" } });
                            });
                            toast("Schrift: Inter", "success");
                        }}
                    >
                        Inter
                    </button>
                    <button
                        type="button"
                        className={`settings-lang-seg__btn${fontStack === "system" ? " is-active" : ""}`}
                        onClick={() => {
                            if (fontStack === "system") return;
                            onPersistClient((c) => {
                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                return mergeClientSettingsPatch(c, { appearance: { ...a, fontStack: "system" } });
                            });
                            toast("Schrift: System", "success");
                        }}
                    >
                        System
                    </button>
                </div>
            </div>
            <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                <div>
                    <b>Dichte</b>
                    <div className="card-sub">Gemütlich · Kompakt · Weit — aktuell {densityLabel}</div>
                </div>
                <div className="settings-density-seg" role="group" aria-label="Raster-Dichte" style={{ width: "100%", justifyContent: "stretch" }}>
                    {(
                        [
                            { id: "cozy" as const, label: "Gemütlich" },
                            { id: "compact" as const, label: "Kompakt" },
                            { id: "spacious" as const, label: "Weit" },
                        ] as const
                    ).map((opt) => (
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
                                toast(`Dichte: ${opt.label}`, "info");
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>Sprache</b>
                    <div className="card-sub">Oberfläche</div>
                </div>
                <div className="settings-lang-seg" role="group" aria-label="Sprache">
                    <button type="button" className={`settings-lang-seg__btn${locale === "de" ? " is-active" : ""}`} onClick={() => onLocaleChange("de")}>
                        DE
                    </button>
                    <button type="button" className={`settings-lang-seg__btn${locale === "en" ? " is-active" : ""}`} onClick={() => onLocaleChange("en")}>
                        EN
                    </button>
                </div>
            </div>
            <div className="settings-row settings-row--wrap settings-row--accent">
                <div className="settings-row-clickable__label">
                    <b>Akzentfarbe</b>
                    <div className="settings-row-muted">
                        {ACCENT_LABELS[accentPresetId]} · Buttons, Links und Fokus
                    </div>
                </div>
                <div role="radiogroup" aria-label="Akzentfarbe" className="settings-accent-inline">
                    {ACCENT_ORDER.map((id: AccentId) => (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={accentPresetId === id}
                            aria-label={`${ACCENT_LABELS[id]}: ${ACCENT_HINTS[id]}`}
                            title={ACCENT_HINTS[id]}
                            className={`settings-accent-inline__swatch${accentPresetId === id ? " is-selected" : ""}`}
                            style={{ background: accentColorCircle(id) }}
                            onClick={() => {
                                if (accentPresetId === id) return;
                                onPersistClient((c) => {
                                    const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                    return mergeClientSettingsPatch(c, { appearance: { ...a, accentPreset: id } });
                                });
                                toast(`Akzent: ${ACCENT_LABELS[id]}`, "success");
                            }}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
