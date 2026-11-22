import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { SHORTCUTS, SHORTCUT_GROUPS, displayKey, isMacPlatform } from "@/lib/shortcuts";
import { matchesQuery, type HelpSectionProps } from "./help-search";

export function HelpShortcuts({ query }: HelpSectionProps) {
    const t = useT();
    const mac = useMemo(() => isMacPlatform(), []);
    const groups = SHORTCUT_GROUPS.map((group) => ({
        group,
        items: SHORTCUTS.filter(
            (s) =>
                s.group === group &&
                matchesQuery(query, t(s.labelKey), s.chords.map((c) => c.map((k) => displayKey(k, mac)).join(" ")).join(" ")),
        ),
    })).filter((g) => g.items.length > 0);

    if (groups.length === 0) return <p className="help-empty">{t("help.no_results").replace("{q}", query)}</p>;

    return (
        <div className="help-grid">
            {groups.map(({ group, items }) => (
                <section key={group} className="help-card" aria-labelledby={`help-sc-${group}`}>
                    <h3 id={`help-sc-${group}`} className="help-card__title">
                        {t(`help.shortcuts.group.${group}`)}
                    </h3>
                    <dl className="help-shortcut-list">
                        {items.map((s) => (
                            <div key={s.id} className="help-shortcut-row">
                                <dt className="help-shortcut-row__keys">
                                    {s.chords.map((chord, ci) => (
                                        <span key={ci} className="help-chord">
                                            {ci > 0 ? <span className="help-chord__or">/</span> : null}
                                            {chord.map((k, ki) => (
                                                <span key={ki} className="help-chord__key">
                                                    {ki > 0 && s.sequence ? <span className="help-chord__then" aria-hidden>→</span> : null}
                                                    <kbd className="kbd">{displayKey(k, mac)}</kbd>
                                                </span>
                                            ))}
                                        </span>
                                    ))}
                                </dt>
                                <dd className="help-shortcut-row__label">{t(s.labelKey)}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
            <p className="help-footnote">
                {t("help.shortcuts.typing_note")} {t("help.shortcuts.sequence_hint")}
            </p>
        </div>
    );
}
