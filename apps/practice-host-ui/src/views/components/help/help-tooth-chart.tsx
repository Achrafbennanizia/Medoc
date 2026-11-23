/**
 * Help page for the tooth chart. Uses the chart of the examination and treatment screens
 * (`DentalChart` / `DentalArchSvg`) and its rules (`toggleDentalStatus`), so Help can never
 * show something the chart draws differently: a practice chart to try, every status, the click
 * motion, and every combination the chart accepts.
 */
import { useMemo, useState } from "react";
import { dentalStatusLabel, findingToStatusKeys, statusKeysToFinding, toggleDentalStatus, type DentalStatusKey } from "@/lib/dental";
import { useT, useTParams } from "@/lib/i18n";
import type { DentalFinding } from "@/models/types";
import { DentalChart } from "../DentalChart";
import { DentalArchToothIcon } from "../dental-arch-svg";
import { dentalEffectRows } from "../dental-effect-rows";
import { matchesQuery, type HelpSectionProps } from "./help-search";

function markKey(marks: DentalStatusKey[]): string {
    return `help.teeth.mark.${marks.join("_")}`;
}

/** Practice chart start: a few teeth that show statuses and combinations (nothing is saved). */
const PRACTICE_START: Record<string, string> = {
    "16": "crown,caries",
    "26": "filling",
    "36": "missing,planned",
    "46": "missing,implant",
    "11": "planned",
    "21": "root",
};

function toFindings(teeth: Record<string, string>): DentalFinding[] {
    return Object.entries(teeth).map(([tooth, finding]) => ({
        id: `help-${tooth}`,
        chart_id: "help",
        tooth_number: Number(tooth),
        finding,
        diagnosis: null,
        notes: null,
        created_at: "",
        updated_at: "",
    }));
}

function comboName(t: (k: string) => string, tp: (k: string, p: Record<string, string>) => string, marks: DentalStatusKey[]) {
    const [a, b] = marks;
    return tp("dental.status.combine", { a: dentalStatusLabel(t, a!), b: dentalStatusLabel(t, b!) });
}

export function HelpToothChart({ query }: HelpSectionProps) {
    const t = useT();
    const tp = useTParams();
    const [pulse, setPulse] = useState(false);
    const [teeth, setTeeth] = useState<Record<string, string>>(PRACTICE_START);
    const findings = useMemo(() => toFindings(teeth), [teeth]);
    const rows = dentalEffectRows();
    const singles = rows.filter((row) => row.marks.length === 1);
    const pairs = rows.filter((row) => row.marks.length === 2);

    const statusHits = singles.filter((row) => matchesQuery(query, dentalStatusLabel(t, row.marks[0]!), t(markKey(row.marks))));
    const comboHits = pairs.filter((row) => matchesQuery(query, comboName(t, tp, row.marks), t(markKey(row.marks))));
    const practiceCopy = [t("help.teeth.practice_title"), t("help.teeth.practice_lead"), t("help.teeth.rules")];
    const showPractice = matchesQuery(query, ...practiceCopy);
    const motionCopy = [t("help.teeth.motion.pulse"), t("help.teeth.motion.selection"), t("help.teeth.motion.reduced")];
    const showMotion = matchesQuery(query, t("help.teeth.motion_title"), ...motionCopy);
    const showAny = statusHits.length > 0 || comboHits.length > 0 || showMotion || showPractice;

    const play = () => {
        setPulse(true);
        window.setTimeout(() => setPulse(false), 160);
    };

    /** Same click rule as the examination chart. */
    const apply = async (tooth: number, key: string) => {
        setTeeth((prev) => {
            const next = toggleDentalStatus(findingToStatusKeys(prev[String(tooth)]), key as DentalStatusKey);
            const copy = { ...prev };
            if (next.length) copy[String(tooth)] = statusKeysToFinding(next);
            else delete copy[String(tooth)];
            return copy;
        });
    };

    return (
        <div className="help-stack">
            <p className="help-intro">{t("help.teeth.intro")}</p>
            {query.trim() && !showAny ? <p className="help-empty">{t("help.no_results").replace("{q}", query)}</p> : null}

            {showPractice ? (
                <section className="help-card" aria-labelledby="help-teeth-practice">
                    <div className="help-tooth-practice__head">
                        <h3 id="help-teeth-practice" className="help-card__title">
                            {t("help.teeth.practice_title")}
                        </h3>
                        <button type="button" className="help-tooth-reset" onClick={() => setTeeth(PRACTICE_START)}>
                            {t("help.teeth.practice_reset")}
                        </button>
                    </div>
                    <p className="help-card__meta">{t("help.teeth.practice_lead")}</p>
                    <div className="help-tooth-practice">
                        <DentalChart findings={findings} mode="clinical" onApply={apply} />
                    </div>
                    <p className="help-card__foot">{t("help.teeth.rules")}</p>
                </section>
            ) : null}

            {statusHits.length > 0 ? (
                <section className="help-card" aria-labelledby="help-teeth-status">
                    <h3 id="help-teeth-status" className="help-card__title">
                        {t("help.teeth.statuses_title")}
                    </h3>
                    <ul className="help-tooth-list">
                        {statusHits.map((row) => (
                            <li key={row.id} className="help-tooth-row">
                                <DentalArchToothIcon fdi="36" keys={row.marks} />
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
                    <h3 id="help-teeth-motion" className="help-card__title">
                        {t("help.teeth.motion_title")}
                    </h3>
                    <div className="help-tooth-motion">
                        <button type="button" className="help-tooth-play" onClick={play}>
                            <DentalArchToothIcon fdi="36" keys={["caries"]} selected pulse={pulse} />
                            <span>{t("help.teeth.motion.play")}</span>
                        </button>
                        <ul className="help-tooth-notes">
                            {motionCopy.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    </div>
                </section>
            ) : null}

            {comboHits.length > 0 ? (
                <section className="help-card" aria-labelledby="help-teeth-combo">
                    <h3 id="help-teeth-combo" className="help-card__title">
                        {t("help.teeth.combine_title")}
                    </h3>
                    <p className="help-card__meta">{t("help.teeth.combine_lead")}</p>
                    <ul className="help-tooth-list help-tooth-list--grid">
                        {comboHits.map((row) => (
                            <li key={row.id} className="help-tooth-row">
                                <DentalArchToothIcon fdi="36" keys={row.marks} />
                                <p>
                                    <strong>{comboName(t, tp, row.marks)}</strong>
                                    {t(markKey(row.marks))}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <p className="help-card__foot">{t("help.teeth.record")}</p>
                </section>
            ) : null}
        </div>
    );
}
