/** Help page for the tooth chart: every status, the click motion, and every combination the list can show. */
import { useState } from "react";
import { dentalStatusLabel, type DentalStatusKey } from "@/lib/dental";
import { useT, useTParams } from "@/lib/i18n";
import { DentalMiniToothSvg } from "../dental-mini-tooth-svg";
import { dentalEffectRows } from "../dental-effect-rows";
import { matchesQuery, type HelpSectionProps } from "./help-search";

function markKey(marks: DentalStatusKey[]): string {
    return `help.teeth.mark.${marks.join("_")}`;
}

export function HelpToothChart({ query }: HelpSectionProps) {
    const t = useT();
    const tp = useTParams();
    const [pulse, setPulse] = useState(false);
    const rows = dentalEffectRows();
    const singles = rows.filter((row) => row.marks.length === 1);
    const pairs = rows.filter((row) => row.marks.length === 2);

    const statusHits = singles.filter((row) =>
        matchesQuery(query, dentalStatusLabel(t, row.marks[0]!), t(markKey(row.marks))),
    );
    const comboHits = pairs.filter((row) => {
        const [a, b] = row.marks;
        const name = tp("dental.status.combine", { a: dentalStatusLabel(t, a!), b: dentalStatusLabel(t, b!) });
        return matchesQuery(query, name, t(markKey(row.marks)));
    });
    const motionCopy = [
        t("help.teeth.motion.pulse"),
        t("help.teeth.motion.selection"),
        t("help.teeth.motion.reduced"),
    ];
    const showMotion = matchesQuery(query, t("help.teeth.motion_title"), ...motionCopy);
    const showAny = statusHits.length > 0 || comboHits.length > 0 || showMotion;

    const play = () => {
        setPulse(true);
        window.setTimeout(() => setPulse(false), 160);
    };

    return (
        <div className="help-stack">
            <p className="help-intro">{t("help.teeth.intro")}</p>
            {query.trim() && !showAny ? <p className="help-empty">{t("help.no_results").replace("{q}", query)}</p> : null}

            {statusHits.length > 0 ? (
                <section className="help-card" aria-labelledby="help-teeth-status">
                    <h3 id="help-teeth-status" className="help-card__title">{t("help.teeth.statuses_title")}</h3>
                    <ul className="help-tooth-list">
                        {statusHits.map((row) => (
                            <li key={row.id} className="help-tooth-row">
                                <DentalMiniToothSvg fdi="16" stateKey={row.marks[0]!} width={22} height={34} />
                                <p>
                                    <strong>{dentalStatusLabel(t, row.marks[0]!)}</strong>
                                    {t(markKey(row.marks))}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {showMotion ? (
                <section className="help-card" aria-labelledby="help-teeth-motion">
                    <h3 id="help-teeth-motion" className="help-card__title">{t("help.teeth.motion_title")}</h3>
                    <div className="help-tooth-motion">
                        <button type="button" className={pulse ? "help-tooth-play tooth-btn-pulse" : "help-tooth-play"} onClick={play}>
                            <DentalMiniToothSvg fdi="36" stateKey="caries" selected width={22} height={34} />
                            <span>{t("help.teeth.motion.play")}</span>
                        </button>
                        <ul className="help-tooth-notes">
                            {motionCopy.map((line) => <li key={line}>{line}</li>)}
                        </ul>
                    </div>
                </section>
            ) : null}

            {comboHits.length > 0 ? (
                <section className="help-card" aria-labelledby="help-teeth-combo">
                    <h3 id="help-teeth-combo" className="help-card__title">{t("help.teeth.combine_title")}</h3>
                    <p className="help-card__meta">{t("help.teeth.combine_lead")}</p>
                    <ul className="help-tooth-list">
                        {comboHits.map((row) => {
                            const [a, b] = row.marks;
                            return (
                                <li key={row.id} className="help-tooth-row">
                                    <DentalMiniToothSvg fdi="16" stateKey={a!} marks={row.marks} width={22} height={34} />
                                    <p>
                                        <strong>{tp("dental.status.combine", { a: dentalStatusLabel(t, a!), b: dentalStatusLabel(t, b!) })}</strong>
                                        {t(markKey(row.marks))}
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                    <p className="help-card__foot">{t("help.teeth.record")}</p>
                </section>
            ) : null}
        </div>
    );
}
