/** Every area: what it covers and, level by level, what a person may do there (and the exact
 *  checks behind it, for administrators and support). */
import { useT } from "@/lib/i18n";
import type { AccessCatalog } from "@/systems/practice-host/controllers/access.controller";
import { areaHintKey, areaLabelKey, levelLabelKey, privilegeKey } from "../../access/access-labels";

export function GuideAreas({ areas }: { areas: AccessCatalog["areas"] }) {
    const t = useT();
    return (
        <div className="help-stack">
            {areas.map(({ area, scopable, levels }) => (
                <section key={area} className="help-card" aria-labelledby={`guide-area-${area}`}>
                    <div className="help-card__head">
                        <h3 id={`guide-area-${area}`} className="help-card__title">
                            {t(areaLabelKey(area))}
                        </h3>
                        {scopable ? <span className="pill grey">{t("access.guide.scopable")}</span> : null}
                    </div>
                    <p className="help-card__meta">{t(areaHintKey(area))}</p>
                    <dl className="access-guide__levels">
                        {levels.map(({ level, actions }) => (
                            <div key={level}>
                                <dt>{t(levelLabelKey(level))}</dt>
                                <dd>
                                    {t(privilegeKey(area, level))}
                                    {actions.length ? (
                                        <details className="access-guide__actions">
                                            <summary>{t("access.guide.checks")}</summary>
                                            <code>{actions.join(" · ")}</code>
                                        </details>
                                    ) : null}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
        </div>
    );
}
