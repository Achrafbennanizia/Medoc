/**
 * Help → Roles & privileges: how access works, every privilege explained, and the predefined roles.
 * Generated from the same catalogue the backend enforces (access_catalog.rs), so it cannot drift.
 */
import { useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { levelHintKey, levelLabelKey } from "../access/access-labels";
import { useAccessCatalog } from "../access/use-access-catalog";
import { GuideAreas } from "./access-guide/guide-areas";
import { GuideRoles } from "./access-guide/guide-roles";

const LAYERS = ["login_role", "role", "privileges", "scope", "exceptions", "device"] as const;

export function HelpAccessGuide({ query }: { query: string }) {
    const t = useT();
    const { catalog, error } = useAccessCatalog();
    if (error) return <p className="page-sub">{errorMessage(error)}</p>;
    if (!catalog) return <p className="page-sub">{t("common.loading")}</p>;

    const q = query.trim().toLowerCase();
    const areas = q ? catalog.areas.filter((a) => `${t(`access.area.${a.area}.label`)} ${t(`access.area.${a.area}.hint`)}`.toLowerCase().includes(q)) : catalog.areas;

    return (
        <div className="help-stack access-guide">
            <section className="help-card" aria-labelledby="guide-how">
                <h3 id="guide-how" className="help-card__title">
                    {t("access.guide.how_title")}
                </h3>
                <ol className="about-steps">
                    {LAYERS.map((l) => (
                        <li key={l}>
                            <b>{t(`access.guide.layer.${l}.title`)}</b> — {t(`access.guide.layer.${l}.text`)}
                        </li>
                    ))}
                </ol>
            </section>
            <section className="help-card" aria-labelledby="guide-levels">
                <h3 id="guide-levels" className="help-card__title">
                    {t("access.guide.levels_title")}
                </h3>
                <dl className="access-guide__levels">
                    {catalog.levels.map((l) => (
                        <div key={l}>
                            <dt>{t(levelLabelKey(l))}</dt>
                            <dd>{t(levelHintKey(l))}</dd>
                        </div>
                    ))}
                </dl>
            </section>
            <section className="help-card" aria-labelledby="guide-roles">
                <h3 id="guide-roles" className="help-card__title">
                    {t("access.guide.roles_title")}
                </h3>
                <p className="help-card__meta">{t("access.guide.roles_intro")}</p>
                <GuideRoles catalog={catalog} />
            </section>
            <h3 className="help-card__title">{t("access.guide.areas_title")}</h3>
            <GuideAreas areas={areas} />
        </div>
    );
}
