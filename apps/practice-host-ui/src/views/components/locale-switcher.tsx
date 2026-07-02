import { localeOptionLabelKey, SUPPORTED_LOCALES, useLocale, useT, type Locale } from "@/lib/i18n";

type LocaleSwitcherProps = {
    className?: string;
    locale?: Locale;
    onChange?: (locale: Locale) => void;
};

/** Compact language selector with translated labels (EN · DE · FR · AR). */
export function LocaleSwitcher({ className, locale: localeProp, onChange }: LocaleSwitcherProps) {
    const t = useT();
    const storeLocale = useLocale((s) => s.locale);
    const setLocale = useLocale((s) => s.setLocale);
    const locale = localeProp ?? storeLocale;

    const pick = (id: Locale) => {
        if (locale === id) return;
        if (onChange) onChange(id);
        else setLocale(id);
    };

    return (
        <div
            className={className ?? "settings-lang-seg"}
            role="group"
            aria-label={t("settings.appearance.language.aria")}
        >
            {SUPPORTED_LOCALES.map((id) => (
                <button
                    key={id}
                    type="button"
                    className={`settings-lang-seg__btn${locale === id ? " is-active" : ""}`}
                    aria-pressed={locale === id}
                    lang={id}
                    onClick={() => pick(id)}
                >
                    {t(localeOptionLabelKey(id))}
                </button>
            ))}
        </div>
    );
}
