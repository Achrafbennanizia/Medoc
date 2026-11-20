import { useT } from "@/lib/i18n";
import { matchesQuery, type HelpSectionProps } from "./help-search";

const STEPS = [1, 2, 3, 4, 5] as const;

export function HelpGettingStarted({ query }: HelpSectionProps) {
    const t = useT();
    const steps = STEPS.filter((n) => matchesQuery(query, t(`help.start.step${n}.title`), t(`help.start.step${n}.body`)));
    return (
        <div className="help-stack">
            <p className="help-intro">{t("help.start.intro")}</p>
            {steps.length === 0 ? <p className="help-empty">{t("help.no_results").replace("{q}", query)}</p> : null}
            <ol className="help-steps">
                {steps.map((n) => (
                    <li key={n} className="help-step">
                        <span className="help-step__num" aria-hidden>
                            {n}
                        </span>
                        <div>
                            <h3 className="help-step__title">{t(`help.start.step${n}.title`)}</h3>
                            <p className="help-step__body">{t(`help.start.step${n}.body`)}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
}
